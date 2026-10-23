using Bifrost.Orchestrator.Contracts;

namespace Bifrost.WorkerNode;

public sealed record RegisterWorker
{
    public required Guid NodeId { get; init; }
}

public static class RegisterWorkerHandler
{
    public static WorkerNodeRegistered.Command Handle(RegisterWorker command) =>
        new() { Id = command.NodeId };
}
