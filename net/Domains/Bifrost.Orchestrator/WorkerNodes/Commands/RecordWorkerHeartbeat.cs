using Bifrost.TrackedWorkItems.Dispatch;
using Bifrost.WorkerNodes.Events;
using Bifrost.WorkerNodes.Projections;
using Marten;
using Wolverine.Runtime.Heartbeat;

namespace Bifrost.WorkerNodes.Commands;

public static class RecordWorkerHeartbeatHandler
{
    public static async Task<ProcessWorkItemDispatch?> Handle(
        WolverineHeartbeat heartbeat,
        IDocumentSession session
    )
    {
        if (!Guid.TryParse(heartbeat.ServiceName, out var id))
        {
            return null;
        }

        if (await session.Events.FetchStreamStateAsync(id) is null)
        {
            return null;
        }

        var view = await session.LoadAsync<WorkerNodeView.Model>(id);
        session.Events.Append(id, new WorkerNodeHeartbeatRecorded(heartbeat.SentAt));

        // Sticky-online: only the transition onto the board wakes dispatch.
        if (view is { IsOnline: true })
        {
            return null;
        }

        return new ProcessWorkItemDispatch();
    }
}
