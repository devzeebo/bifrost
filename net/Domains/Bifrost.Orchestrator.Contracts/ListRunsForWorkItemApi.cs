using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class ListRunsForWorkItemApi
{
    public sealed record Query
    {
        public required Guid WorkItemId { get; init; }
    }

    public sealed record Response
    {
        public sealed record Item
        {
            public required Guid Id { get; init; }
            public required Guid WorkItemId { get; init; }
            public required int Position { get; init; }
            public required DateTimeOffset CreatedAt { get; init; }
            public RunOutcome? Outcome { get; init; }
        }

        public required IReadOnlyList<Item> Items { get; init; }
    }
}
