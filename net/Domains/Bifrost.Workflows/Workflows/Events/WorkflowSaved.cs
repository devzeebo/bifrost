using Bifrost.Workflows.Contracts;

namespace Bifrost.Workflows.Events;

public sealed record WorkflowSaved
{
    public required string Name { get; init; }
    public required IReadOnlyList<WorkflowNode> Nodes { get; init; }
}
