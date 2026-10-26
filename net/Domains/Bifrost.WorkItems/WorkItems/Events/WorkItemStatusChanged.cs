namespace Bifrost.WorkItems.Events;

public sealed record WorkItemStatusChanged
{
    public required WorkItemStatus Status { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
