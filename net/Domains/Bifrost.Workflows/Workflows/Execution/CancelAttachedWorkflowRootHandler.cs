using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.Workflows.Contracts;
using Wolverine;
using Wolverine.Http;

namespace Bifrost.Workflows.Execution;

/// <summary>
/// Lists children then cancels them and the root. Runs on the same sequential local queue as
/// <see cref="AdvanceWorkflowExecution"/> so DraftAndScheduleNode cannot interleave with listing.
/// </summary>
public static class CancelAttachedWorkflowRootHandler
{
    [WolverinePost("/cancel-attached-workflow-root"), EmptyResponse]
    public static async Task Handle(
        CancelAttachedWorkflowRootApi.Command command,
        IMessageBus local
    )
    {
        await local
            .PublishAsync(
                new CancelAttachedWorkflowRoot
                {
                    RootWorkItemId = command.RootWorkItemId,
                    Actor = command.Actor,
                    Reason = command.Reason,
                }
            )
            .ConfigureAwait(false);
    }

    public static async Task Handle(CancelAttachedWorkflowRoot message, IBifrostBus bus)
    {
        GetTrackedWorkItemApi.Response root;
        try
        {
            root = await bus.Request<GetTrackedWorkItemApi.Query, GetTrackedWorkItemApi.Response>(
                new GetTrackedWorkItemApi.Query { Id = message.RootWorkItemId }
            );
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.NotFound)
        {
            return;
        }

        if (root.Status != TrackedWorkItemStatuses.Executing)
        {
            return;
        }

        await AttachedWorkflowChildren
            .CancelNonTerminal(
                bus,
                message.RootWorkItemId,
                message.Actor,
                "attached workflow canceled"
            )
            .ConfigureAwait(false);

        // Child terminals may already have advanced and canceled the root.
        try
        {
            root = await bus.Request<GetTrackedWorkItemApi.Query, GetTrackedWorkItemApi.Response>(
                new GetTrackedWorkItemApi.Query { Id = message.RootWorkItemId }
            );
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.NotFound)
        {
            return;
        }

        if (root.Status == TrackedWorkItemStatuses.Canceled)
        {
            return;
        }

        if (root.Status != TrackedWorkItemStatuses.Executing)
        {
            return;
        }

        await bus.Request<ApplyCancelTrackedWorkItemApi.Command, Unit>(
                new ApplyCancelTrackedWorkItemApi.Command
                {
                    Id = message.RootWorkItemId,
                    Actor = message.Actor,
                    Reason = message.Reason,
                    Expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Executing },
                }
            )
            .ConfigureAwait(false);
    }
}
