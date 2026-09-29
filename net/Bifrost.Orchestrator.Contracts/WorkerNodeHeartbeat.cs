namespace Bifrost.Orchestrator.Contracts;

public static class WorkerNodeHeartbeat
{
    public sealed record Event
    {
        public required Guid Id { get; init; }
    }
}
