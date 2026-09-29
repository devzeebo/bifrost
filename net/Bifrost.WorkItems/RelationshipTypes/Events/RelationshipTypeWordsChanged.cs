using System.Text.Json.Serialization;

namespace Bifrost.RelationshipTypes.Events;

public sealed record RelationshipTypeWordsChanged
{
    [JsonConstructor]
    internal RelationshipTypeWordsChanged(
        Guid relationshipTypeId,
        RelationshipTypeWord previousForwardWord,
        RelationshipTypeWord previousInverseWord,
        RelationshipTypeWord forwardWord,
        RelationshipTypeWord inverseWord
    )
    {
        RelationshipTypeId = relationshipTypeId;
        PreviousForwardWord = previousForwardWord;
        PreviousInverseWord = previousInverseWord;
        ForwardWord = forwardWord;
        InverseWord = inverseWord;
    }

    public Guid RelationshipTypeId { get; init; }
    public RelationshipTypeWord PreviousForwardWord { get; init; }
    public RelationshipTypeWord PreviousInverseWord { get; init; }
    public RelationshipTypeWord ForwardWord { get; init; }
    public RelationshipTypeWord InverseWord { get; init; }
}
