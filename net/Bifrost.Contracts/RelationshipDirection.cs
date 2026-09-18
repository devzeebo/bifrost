namespace Bifrost.Contracts;

public enum RelationshipDirection
{
    Forward = 0,
    Inverse = 1,
}

public sealed record Edge
{
    public required Guid RelationshipTypeId { get; init; }
    public required RelationshipDirection Direction { get; init; }
    public required Guid RelatedWorkItemId { get; init; }
}
