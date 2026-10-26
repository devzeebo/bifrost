namespace Bifrost.WorkItems.Events;

public sealed record RelationshipAdded
{
    public required Guid RelationshipTypeId { get; init; }
    public required string Word { get; init; }
    public required RelationshipDirection Direction { get; init; }
    public required Guid RelatedWorkItemId { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
