namespace Bifrost.TrackedWorkItems.Workflow;

public sealed record AdvanceWorkflowExecution
{
    public required Guid RootWorkItemId { get; init; }
}
