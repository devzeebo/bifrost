using Bifrost.WorkerNodes.Events;
using Marten;
using Wolverine.Runtime.Heartbeat;

namespace Bifrost.WorkerNodes.Commands;

public static class RecordWorkerHeartbeatHandler
{
    public static async Task Handle(WolverineHeartbeat heartbeat, IDocumentSession session)
    {
        if (!Guid.TryParse(heartbeat.ServiceName, out var id))
        {
            return;
        }

        if (await session.Events.FetchStreamStateAsync(id) is null)
        {
            return;
        }

        session.Events.Append(id, new WorkerNodeHeartbeatRecorded(heartbeat.SentAt));
    }
}
