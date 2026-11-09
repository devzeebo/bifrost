using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;

namespace Bifrost.WorkerNode;

/// <summary>
/// Idempotent accept of a claimed handoff. Harness execution is #61 —
/// this story only records that the worker took the message.
/// </summary>
public static class ExecuteClaimedWorkHandler
{
    public static async Task Handle(
        ExecuteClaimedWorkApi.Command command,
        IBifrostBus bus,
        WorkerNodeIdentity identity,
        AcceptedClaimedWork accepted
    )
    {
        if (command.WorkerId != identity.Id)
        {
            return;
        }

        if (accepted.Contains(command.WorkItemId, command.RunId))
        {
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

        accepted.Record(command.WorkItemId, command.RunId);
    }
}

/// <summary>In-process set of accepted (work item, run) pairs for handoff idempotency.</summary>
public sealed class AcceptedClaimedWork
{
    readonly HashSet<(Guid WorkItemId, Guid RunId)> _accepted = [];
    readonly object _gate = new();

    public bool Contains(Guid workItemId, Guid runId)
    {
        lock (_gate)
        {
            return _accepted.Contains((workItemId, runId));
        }
    }

    public void Record(Guid workItemId, Guid runId)
    {
        lock (_gate)
        {
            _accepted.Add((workItemId, runId));
        }
    }
}
