using Bifrost.TrackedWorkItems.Dispatch;
using Bifrost.WorkerNodes.Events;
using Bifrost.WorkerNodes.Projections;
using Marten;
using Wolverine;
using Wolverine.Runtime.Heartbeat;

namespace Bifrost.WorkerNodes.Commands;

public static class RecordWorkerHeartbeatHandler
{
    public static async Task<OutgoingMessages?> Handle(
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

        // Presence-only: a beat never judges the worker offline. Coming back from a
        // recorded offline is an observation — the first fresh beat speaks online.
        if (view is not { IsOnline: false })
        {
            return null;
        }

        session.Events.Append(id, new WorkerDeclaredOnline { At = heartbeat.SentAt });
        return [new ProcessWorkItemDispatch()];
    }
}
