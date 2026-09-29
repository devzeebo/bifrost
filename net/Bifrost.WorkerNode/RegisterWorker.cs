using Bifrost.Orchestrator.Contracts;
using Wolverine;

namespace Bifrost.WorkerNode;

public sealed record RegisterWorker
{
    public required Guid NodeId { get; init; }
}

public static class RegisterWorkerHandler
{
    public static OutgoingMessages Handle(RegisterWorker command)
    {
        var outgoing = new OutgoingMessages();
        outgoing.Add(new WorkerNodeRegistered.Event { Id = command.NodeId });
        outgoing.Delay(new SendHeartbeat { NodeId = command.NodeId }, TimeSpan.FromSeconds(1));
        return outgoing;
    }
}
