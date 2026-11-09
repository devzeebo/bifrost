namespace Bifrost.TrackedWorkItems.Dispatch;

/// <summary>Internal handoff attempt after a successful claim.</summary>
public sealed record DeliverClaimedWork
{
    public required Guid WorkItemId { get; init; }
    public required Guid WorkerId { get; init; }
    public required Guid RunId { get; init; }
}
