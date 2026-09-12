namespace Bifrost.Domain.RelationshipTypes.Events;

public sealed record RelationshipTypeDefined
{
    public required Guid Id { get; init; }
    public required RelationshipTypeWord ForwardWord { get; init; }
    public required RelationshipTypeWord InverseWord { get; init; }
}
