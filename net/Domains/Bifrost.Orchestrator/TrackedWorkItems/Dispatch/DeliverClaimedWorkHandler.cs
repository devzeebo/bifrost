using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.TrackedWorkItems.Projections;
using Marten;

namespace Bifrost.TrackedWorkItems.Dispatch;

public static class DeliverClaimedWorkHandler
{
    public static async Task Handle(
        DeliverClaimedWork message,
        IQuerySession session,
        IBifrostBus bus,
        CancellationToken ct
    )
    {
        var item = await session.LoadAsync<TrackedWorkItemView.Model>(message.WorkItemId);
        if (
            item is null
            || item.HolderId != message.WorkerId
            || item.Status
                is not (TrackedWorkItemStatuses.Claimed or TrackedWorkItemStatuses.Running)
        )
        {
            // Terminal or released between claim and handoff — deliver nothing.
            return;
        }

        try
        {
            await bus.Request<ExecuteClaimedWorkApi.Command, Unit>(
                new ExecuteClaimedWorkApi.Command
                {
                    WorkItemId = message.WorkItemId,
                    WorkerId = message.WorkerId,
                    RunId = message.RunId,
                },
                ct
            );
        }
        catch (BusException) when (!ct.IsCancellationRequested)
        {
            // At-least-once: retry while the holder stays online and still holds the item.
            if (await StillHeld(session, message))
            {
                throw;
            }
        }
    }

    static async Task<bool> StillHeld(IQuerySession session, DeliverClaimedWork message)
    {
        var item = await session.LoadAsync<TrackedWorkItemView.Model>(message.WorkItemId);
        return item is not null
            && item.HolderId == message.WorkerId
            && item.Status
                is TrackedWorkItemStatuses.Claimed
                    or TrackedWorkItemStatuses.Running;
    }
}
