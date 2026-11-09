using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Wolverine.Attributes;

namespace Bifrost.WorkerNode;

/// <summary>
/// Durable accept of a claimed handoff; harness execution is enqueued serially.
/// Invoked via the message-bus RPC handler, not Wolverine discovery.
/// </summary>
[WolverineIgnore]
public static class ExecuteClaimedWorkHandler
{
    public static async Task Handle(
        ExecuteClaimedWorkApi.Command command,
        IBifrostBus bus,
        IHarnessJobScheduler jobs,
        WorkerNodeIdentity identity,
        IHarnessAcceptStore accepts
    )
    {
        if (command.WorkerId != identity.Id)
        {
            return;
        }

        var existing = accepts.GetState(command.WorkItemId, command.RunId);
        if (existing is HarnessAcceptState.Concluded or HarnessAcceptState.Running)
        {
            return;
        }

        if (existing is HarnessAcceptState.Accepted)
        {
            // Accept survived a crash or failed enqueue — reschedule without double-accept.
            await Enqueue(jobs, command).ConfigureAwait(false);
            return;
        }

        GetTrackedWorkItemApi.Response item;
        try
        {
            item = await bus.Request<GetTrackedWorkItemApi.Query, GetTrackedWorkItemApi.Response>(
                new GetTrackedWorkItemApi.Query { Id = command.WorkItemId }
            );
        }
        catch (BusException)
        {
            // Orchestrator unreachable or item gone — let the bus retry.
            throw;
        }

        if (
            item.HolderId != identity.Id
            || item.Status
                is not (
                    TrackedWorkItemStatuses.Claimed
                    or TrackedWorkItemStatuses.Running
                )
        )
        {
            // Cancel / release / wrong holder won between claim and accept.
            return;
        }

        if (!accepts.TryAccept(command.WorkItemId, command.RunId))
        {
            // Lost the race with another delivery; if it stayed Accepted, still enqueue.
            if (accepts.GetState(command.WorkItemId, command.RunId) is HarnessAcceptState.Accepted)
            {
                await Enqueue(jobs, command).ConfigureAwait(false);
            }

            return;
        }

        await Enqueue(jobs, command).ConfigureAwait(false);
    }

    static Task Enqueue(IHarnessJobScheduler jobs, ExecuteClaimedWorkApi.Command command) =>
        jobs.Enqueue(
            new ExecuteHarness
            {
                WorkItemId = command.WorkItemId,
                RunId = command.RunId,
            }
        );
}
