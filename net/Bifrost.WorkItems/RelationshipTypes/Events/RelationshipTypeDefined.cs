using System.Text.Json.Serialization;

namespace Bifrost.RelationshipTypes.Events;

public sealed record RelationshipTypeDefined
{
    [JsonConstructor]
    internal RelationshipTypeDefined(
        Guid id,
        RelationshipTypeWord forwardWord,
        RelationshipTypeWord inverseWord
    )
    {
        Id = id;
        ForwardWord = forwardWord;
        InverseWord = inverseWord;
    }

    public Guid Id { get; init; }
    public RelationshipTypeWord ForwardWord { get; init; }
    public RelationshipTypeWord InverseWord { get; init; }
}
