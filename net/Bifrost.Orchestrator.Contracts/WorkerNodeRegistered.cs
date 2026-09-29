namespace Bifrost.Orchestrator.Contracts;

public static class WorkerNodeRegistered
{
    public sealed record Event
    {
        public required Guid Id { get; init; }
    }
}
