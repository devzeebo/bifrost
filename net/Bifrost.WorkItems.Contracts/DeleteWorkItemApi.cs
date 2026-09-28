namespace Bifrost.WorkItems.Contracts;

public static class DeleteWorkItemApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }
}
