using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class GetTrackedWorkItemApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid Id { get; init; }
        public required string Status { get; init; }
    }
}
