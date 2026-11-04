namespace Bifrost.TrackedWorkItems.Events;

public sealed record TrackedWorkItemCreated
{
    public required Guid Id { get; init; }
    public required string Status { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
