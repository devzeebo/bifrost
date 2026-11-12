using Bifrost.MessageBus;
using Bifrost.Rpc;
using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Projections;
using Bifrost.Workflows.ValueObjects;
using Bifrost.WorkItems.Contracts;
using Marten;
using Wolverine.Http;

namespace Bifrost.Workflows.Commands;

public static class CreateAttachedWorkItemHandler
{
    public static async Task Validate(
        CreateAttachedWorkItemApi.Command command,
        IQuerySession session
    )
    {
        var workflow = await session.LoadAsync<WorkflowView.Model>(command.WorkflowId);
        if (workflow is null || workflow.IsDeleted)
        {
            throw new CommandValidationException(
                $"Workflow {command.WorkflowId} does not exist."
            );
        }

        WorkflowStartability.EnsureStartable(workflow);
    }

    [WolverinePost("/create-attached-work-item"), EmptyResponse]
    public static async Task Handle(CreateAttachedWorkItemApi.Command command, IBifrostBus bus)
    {
        try
        {
            await bus.Request<CreateWorkItemApi.Command, Unit>(
                new CreateWorkItemApi.Command
                {
                    Id = command.WorkItemId,
                    Data = command.Data,
                    Status = command.Status,
                    Metadata = WorkItemInputDefaults.AttachmentMetadata(command.WorkflowId),
                    Actor = command.Actor,
                    Reason = command.Reason,
                }
            );
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.Validation)
        {
            throw new CommandValidationException(ex.Error.Message);
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.NotFound)
        {
            throw new NotFoundException(ex.Error.Message);
        }
    }
}
