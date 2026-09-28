namespace Bifrost.DataPlane.Contracts;

public static class AddRelationshipApi
{
    public sealed record Command
    {
        public required Guid WorkItemId { get; init; }
        public required string Word { get; init; }
        public required Guid RelatedWorkItemId { get; init; }
    }
}
