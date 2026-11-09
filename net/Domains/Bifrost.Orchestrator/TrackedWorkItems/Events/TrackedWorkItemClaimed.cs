namespace Bifrost.TrackedWorkItems.Events;

public sealed record TrackedWorkItemClaimed
{
    public required Guid WorkerId { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
