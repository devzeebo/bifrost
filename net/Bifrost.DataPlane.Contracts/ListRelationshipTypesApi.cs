namespace Bifrost.DataPlane.Contracts;

public static class ListRelationshipTypesApi
{
    public sealed record Query;

    public sealed record Response
    {
        public required IReadOnlyList<Item> Items { get; init; }

        public sealed record Item
        {
            public required Guid Id { get; init; }
            public required string ForwardWord { get; init; }
            public required string InverseWord { get; init; }
            public bool IsActive { get; init; }
        }
    }
}
