namespace Bifrost.DataPlane.Contracts;

public static class ChangeWorkItemStatusApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required WorkItemStatus Status { get; init; }
    }
}
