namespace Bifrost.WorkItems.Events;

public sealed record WorkItemDeleted
{
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
