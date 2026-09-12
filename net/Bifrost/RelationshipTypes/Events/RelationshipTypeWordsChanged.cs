namespace Bifrost.RelationshipTypes.Events;

public sealed record RelationshipTypeWordsChanged
{
    public required Guid RelationshipTypeId { get; init; }
    public required RelationshipTypeWord PreviousForwardWord { get; init; }
    public required RelationshipTypeWord PreviousInverseWord { get; init; }
    public required RelationshipTypeWord ForwardWord { get; init; }
    public required RelationshipTypeWord InverseWord { get; init; }
}
