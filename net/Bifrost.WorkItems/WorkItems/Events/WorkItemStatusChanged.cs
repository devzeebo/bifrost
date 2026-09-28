namespace Bifrost.WorkItems.Events;

public sealed record WorkItemStatusChanged
{
    public required WorkItemStatus Status { get; init; }
}
