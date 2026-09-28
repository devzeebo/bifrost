namespace Bifrost.DataPlane.Contracts;

public static class ChangeRelationshipTypeWordsApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required RelationshipTypeWord ForwardWord { get; init; }
        public required RelationshipTypeWord InverseWord { get; init; }
    }
}
