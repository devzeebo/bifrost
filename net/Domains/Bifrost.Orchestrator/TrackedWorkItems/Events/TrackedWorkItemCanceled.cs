namespace Bifrost.TrackedWorkItems.Events;

public sealed record TrackedWorkItemCanceled
{
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
