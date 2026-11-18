using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Execution;
using Bifrost.Workflows.Projections;
using Bifrost.Workflows.ValueObjects;
using Bifrost.WorkItems.Contracts;
using Marten;
using Wolverine;
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
    public static async Task Handle(
        CreateAttachedWorkItemApi.Command command,
        IBifrostBus bus,
        IMessageBus local
    )
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

        try
        {
            await bus.Request<CreateTrackedWorkItemApi.Command, Unit>(
                new CreateTrackedWorkItemApi.Command
                {
                    Id = command.WorkItemId,
                    Actor = WorkItemLifecycleActors.Orchestrator,
                    Reason = "track attached workflow root",
                    ScheduleDispatch = false,
                }
            );
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.Validation)
        {
            throw new CommandValidationException(ex.Error.Message);
        }

        await local
            .PublishAsync(new AdvanceWorkflowExecution { RootWorkItemId = command.WorkItemId })
            .ConfigureAwait(false);
    }
}
