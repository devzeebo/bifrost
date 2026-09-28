namespace Bifrost.WorkItems.Contracts;

public static class RetireRelationshipTypeApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }
}
