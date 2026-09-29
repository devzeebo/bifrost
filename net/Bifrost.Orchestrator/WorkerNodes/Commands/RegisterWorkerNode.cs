using Bifrost.WorkerNodes.Aggregate;
using Bifrost.WorkerNodes.Events;
using Marten;
using Contract = Bifrost.Orchestrator.Contracts.WorkerNodeRegistered;

namespace Bifrost.WorkerNodes.Commands;

public static class RegisterWorkerNodeHandler
{
    public static async Task Handle(Contract.Command message, IDocumentSession session)
    {
        if (await session.Events.FetchStreamStateAsync(message.Id) is not null)
        {
            return;
        }

        session.Events.StartStream<WorkerNode>(
            message.Id,
            new WorkerNodeRegistered(message.Id)
        );
    }
}
