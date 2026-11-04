namespace Bifrost.TrackedWorkItems.Events;

public sealed record TrackedWorkItemFailed
{
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
