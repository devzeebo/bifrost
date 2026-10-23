using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class ListWorkItemsApi
{
    public sealed record Query
    {
        public string? Status { get; init; }
    }

    public sealed record Response
    {
        public sealed record Item
        {
            public required Guid Id { get; init; }
            public required string Status { get; init; }
            public bool IsDeleted { get; init; }
        }
    }
}
