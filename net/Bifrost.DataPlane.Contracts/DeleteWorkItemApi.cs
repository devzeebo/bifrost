namespace Bifrost.DataPlane.Contracts;

public static class DeleteWorkItemApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }
}
