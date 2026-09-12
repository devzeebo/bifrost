namespace Bifrost.WorkItems.Events;

public sealed record RelationshipRemoved
{
    public required Guid RelationshipTypeId { get; init; }
    public required RelationshipDirection Direction { get; init; }
    public required Guid RelatedWorkItemId { get; init; }
}
