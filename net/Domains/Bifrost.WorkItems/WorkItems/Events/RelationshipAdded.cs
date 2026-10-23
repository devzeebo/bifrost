using System.Text.Json.Serialization;

namespace Bifrost.WorkItems.Events;

public sealed record RelationshipAdded
{
    [JsonConstructor]
    internal RelationshipAdded(
        Guid relationshipTypeId,
        string word,
        RelationshipDirection direction,
        Guid relatedWorkItemId
    )
    {
        RelationshipTypeId = relationshipTypeId;
        Word = word;
        Direction = direction;
        RelatedWorkItemId = relatedWorkItemId;
    }

    public Guid RelationshipTypeId { get; init; }
    public string Word { get; init; }
    public RelationshipDirection Direction { get; init; }
    public Guid RelatedWorkItemId { get; init; }
}
