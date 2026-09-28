namespace Bifrost.WorkItems.Contracts;

public static class DefineRelationshipTypeApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required RelationshipTypeWord ForwardWord { get; init; }
        public required RelationshipTypeWord InverseWord { get; init; }
    }
}
