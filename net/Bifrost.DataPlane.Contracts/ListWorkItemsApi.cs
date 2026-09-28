namespace Bifrost.DataPlane.Contracts;

public static class ListWorkItemsApi
{
    public sealed record Query
    {
        public string? Status { get; init; }
    }

    public sealed record Response
    {
        public required IReadOnlyList<Item> Items { get; init; }

        public sealed record Item
        {
            public required Guid Id { get; init; }
            public required string Status { get; init; }
            public bool IsDeleted { get; init; }
        }
    }
}
