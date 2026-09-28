namespace Bifrost.WorkItems.Contracts;

public static class RemoveRelationshipApi
{
    public sealed record Command
    {
        public required Guid WorkItemId { get; init; }
        public required string Word { get; init; }
        public required Guid RelatedWorkItemId { get; init; }
    }
}
