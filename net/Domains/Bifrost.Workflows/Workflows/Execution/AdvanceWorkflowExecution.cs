namespace Bifrost.Workflows.Execution;

public sealed record AdvanceWorkflowExecution
{
    public required Guid RootWorkItemId { get; init; }
}
