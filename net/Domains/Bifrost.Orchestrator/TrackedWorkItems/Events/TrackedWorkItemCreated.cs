namespace Bifrost.TrackedWorkItems.Events;

public sealed record TrackedWorkItemCreated
{
    public required Guid Id { get; init; }
    public required string Status { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }

    /// <summary>
    /// When false, ProcessWorkItemDispatch must not claim this item while Pending.
    /// Sticky for the stream lifetime (default true keeps older events dispatchable).
    /// </summary>
    public bool ScheduleDispatch { get; init; } = true;
}
