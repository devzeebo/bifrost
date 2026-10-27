using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class GetWorkItemHistoryApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required IReadOnlyList<Change> Changes { get; init; }

        public sealed record Change
        {
            public required string Type { get; init; }
            public required string Actor { get; init; }
            public required string Reason { get; init; }
            public required DateTimeOffset At { get; init; }
            public string? Status { get; init; }
        }
    }
}
