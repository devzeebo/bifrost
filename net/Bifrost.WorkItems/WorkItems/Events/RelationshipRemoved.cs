using System.Text.Json.Serialization;

namespace Bifrost.WorkItems.Events;

public sealed record RelationshipRemoved
{
    [JsonConstructor]
    internal RelationshipRemoved(
        Guid relationshipTypeId,
        RelationshipDirection direction,
        Guid relatedWorkItemId
    )
    {
        RelationshipTypeId = relationshipTypeId;
        Direction = direction;
        RelatedWorkItemId = relatedWorkItemId;
    }

    public Guid RelationshipTypeId { get; init; }
    public RelationshipDirection Direction { get; init; }
    public Guid RelatedWorkItemId { get; init; }
}
