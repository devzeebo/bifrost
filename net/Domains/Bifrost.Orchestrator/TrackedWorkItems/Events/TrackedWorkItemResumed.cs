namespace Bifrost.TrackedWorkItems.Events;

public sealed record TrackedWorkItemResumed
{
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
