using System.Text.Json.Serialization;

namespace Bifrost.RelationshipTypes.Events;

public sealed record RelationshipTypeRetired
{
    [JsonConstructor]
    internal RelationshipTypeRetired(
        Guid relationshipTypeId,
        RelationshipTypeWord forwardWord,
        RelationshipTypeWord inverseWord
    )
    {
        RelationshipTypeId = relationshipTypeId;
        ForwardWord = forwardWord;
        InverseWord = inverseWord;
    }

    public Guid RelationshipTypeId { get; init; }
    public RelationshipTypeWord ForwardWord { get; init; }
    public RelationshipTypeWord InverseWord { get; init; }
}
