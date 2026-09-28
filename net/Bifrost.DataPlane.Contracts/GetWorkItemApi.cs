using System.Text.Json.Nodes;

namespace Bifrost.DataPlane.Contracts;

public static class GetWorkItemApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
        public required string Status { get; init; }
        public required IReadOnlyList<Relationship> Relationships { get; init; }
        public bool IsDeleted { get; init; }

        public sealed record Relationship
        {
            public required Guid RelationshipTypeId { get; init; }
            public required string Word { get; init; }
            public required RelationshipDirection Direction { get; init; }
            public required Guid RelatedWorkItemId { get; init; }
        }
    }
}
