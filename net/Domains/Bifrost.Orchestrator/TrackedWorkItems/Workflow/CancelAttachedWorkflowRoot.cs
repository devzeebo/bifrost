namespace Bifrost.TrackedWorkItems.Workflow;

/// <summary>
/// Cancels an attached workflow root after discovering and canceling in-flight node executions.
/// Shares a sequential local queue with <see cref="AdvanceWorkflowExecution"/> so drafting
/// cannot interleave with child discovery.
/// </summary>
public sealed record CancelAttachedWorkflowRoot
{
    public required Guid RootWorkItemId { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
