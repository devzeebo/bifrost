namespace Bifrost.Orchestrator.Contracts;

/// <summary>
/// Workflow-agnostic signal that a tracked work item reached a terminal status.
/// Published by the Orchestrator; Workflows (and others) may subscribe.
/// </summary>
public sealed record TrackedWorkItemTerminal
{
    public required Guid WorkItemId { get; init; }
    public required string Status { get; init; }
    public required string Reason { get; init; }
}
