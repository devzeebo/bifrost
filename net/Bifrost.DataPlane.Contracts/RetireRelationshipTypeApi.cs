namespace Bifrost.DataPlane.Contracts;

public static class RetireRelationshipTypeApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }
}
