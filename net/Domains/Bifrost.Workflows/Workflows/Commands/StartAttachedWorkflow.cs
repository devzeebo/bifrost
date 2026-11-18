using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Execution;
using Bifrost.WorkItems.Contracts;
using Wolverine;
using Wolverine.Http;

namespace Bifrost.Workflows.Commands;

public static class StartAttachedWorkflowHandler
{
    public static async Task Validate(StartAttachedWorkflowApi.Command command, IBifrostBus bus)
    {
        GetWorkItemApi.Response ledger;
        try
        {
            ledger = await bus.Request<GetWorkItemApi.Query, GetWorkItemApi.Response>(
                new GetWorkItemApi.Query { Id = command.WorkItemId }
            );
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.NotFound)
        {
            throw new NotFoundException(ex.Error.Message);
        }

        if (!WorkItemInputDefaults.IsAttachedWorkflowRoot(ledger.Metadata))
        {
            throw new CommandValidationException(
                $"Work item {command.WorkItemId} is not an attached workflow root."
            );
        }
    }

    [WolverinePost("/start-attached-workflow"), EmptyResponse]
    public static async Task Handle(
        StartAttachedWorkflowApi.Command command,
        IBifrostBus bus,
        IMessageBus local
    )
    {
        try
        {
            await bus.Request<CreateTrackedWorkItemApi.Command, Unit>(
                new CreateTrackedWorkItemApi.Command
                {
                    Id = command.WorkItemId,
                    Actor = WorkItemLifecycleActors.Orchestrator,
                    Reason = command.Reason,
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
