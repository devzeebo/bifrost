namespace Bifrost.Orchestrator.Contracts;

public static class WorkerNodeRegistered
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }
}
