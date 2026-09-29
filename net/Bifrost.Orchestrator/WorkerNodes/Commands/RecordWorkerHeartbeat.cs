using Bifrost.WorkerNodes.Events;
using Marten;
using Contract = Bifrost.Orchestrator.Contracts.WorkerNodeHeartbeat;

namespace Bifrost.WorkerNodes.Commands;

public static class RecordWorkerHeartbeatHandler
{
    public static async Task Handle(Contract.Event message, IDocumentSession session)
    {
        if (await session.Events.FetchStreamStateAsync(message.Id) is null)
        {
            return;
        }

        session.Events.Append(
            message.Id,
            new WorkerNodeHeartbeatRecorded { At = DateTimeOffset.UtcNow }
        );
    }
}
