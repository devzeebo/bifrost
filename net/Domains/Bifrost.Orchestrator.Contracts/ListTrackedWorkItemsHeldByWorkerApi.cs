using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class ListTrackedWorkItemsHeldByWorkerApi
{
    public sealed record Query
    {
        public required Guid WorkerId { get; init; }
    }

    public sealed record Response
    {
        public required IReadOnlyList<Item> Items { get; init; }
    }

    public sealed record Item
    {
        public required Guid Id { get; init; }
        public required string Status { get; init; }
        public required Guid HolderId { get; init; }
    }
}
