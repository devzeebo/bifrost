namespace Bifrost.Domain.RelationshipTypes.Events;

public sealed record RelationshipTypeRetired
{
    public required Guid RelationshipTypeId { get; init; }
    public required RelationshipTypeWord ForwardWord { get; init; }
    public required RelationshipTypeWord InverseWord { get; init; }
}
