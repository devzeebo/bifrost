using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.Workflows.Contracts;
using Bifrost.WorkItems.Contracts;
using Wolverine;

namespace Bifrost.Workflows.Execution;

public static class TrackedWorkItemTerminalHandler
{
    public static async Task Handle(
        TrackedWorkItemTerminal message,
        IBifrostBus bus,
        IMessageBus local
    )
    {
        GetWorkItemApi.Response ledger;
        try
        {
            ledger = await bus.Request<GetWorkItemApi.Query, GetWorkItemApi.Response>(
                new GetWorkItemApi.Query { Id = message.WorkItemId }
            );
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.NotFound)
        {
            return;
        }

        if (
            WorkItemInputDefaults.TryReadRootWorkItemId(ledger.Metadata, out var rootWorkItemId)
        )
        {
            await local
                .PublishAsync(new AdvanceWorkflowExecution { RootWorkItemId = rootWorkItemId })
                .ConfigureAwait(false);
        }
    }
}
