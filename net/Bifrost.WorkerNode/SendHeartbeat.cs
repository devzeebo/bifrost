using Bifrost.Orchestrator.Contracts;
using Wolverine;

namespace Bifrost.WorkerNode;

public sealed record SendHeartbeat
{
    public required Guid NodeId { get; init; }
}

public static class SendHeartbeatHandler
{
    public static OutgoingMessages Handle(SendHeartbeat command)
    {
        var outgoing = new OutgoingMessages();
        outgoing.Add(new WorkerNodeHeartbeat.Event { Id = command.NodeId });
        outgoing.Delay(command, TimeSpan.FromSeconds(1));
        return outgoing;
    }
}
