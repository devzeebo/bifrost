using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Projections;
using Bifrost.WorkerNodes.Aggregate;
using Bifrost.WorkerNodes.Events;
using Marten;
using Wolverine;

namespace Bifrost.WorkerNodes.Commands;

public static class DeclareWorkerOfflineHandler
{
    public static async Task<OutgoingMessages?> Handle(
        DeclareWorkerOffline command,
        IDocumentSession session
    )
    {
        var stream = await session.Events.FetchForWriting<WorkerNode>(command.WorkerId);
        var node = stream.Aggregate;
        if (node is null || !node.IsOnline)
        {
            // Unknown or already offline — idempotent no-op.
            return null;
        }

        stream.AppendMany(new WorkerDeclaredOffline { At = DateTimeOffset.UtcNow });

        var held = await session
            .Query<TrackedWorkItemView.Model>()
            .Where(i =>
                i.HolderId == command.WorkerId
                && (
                    i.Status == TrackedWorkItemStatuses.Claimed
                    || i.Status == TrackedWorkItemStatuses.Running
                    || i.Status == TrackedWorkItemStatuses.NeedsAttention
                )
            )
            .ToListAsync();

        if (held.Count == 0)
        {
            return null;
        }

        var cascades = new OutgoingMessages();
        foreach (var item in held)
        {
            cascades.Add(
                new ReleaseHeldWorkForDeadWorker
                {
                    WorkItemId = item.Id,
                    WorkerId = command.WorkerId,
                }
            );
        }

        return cascades;
    }
}
