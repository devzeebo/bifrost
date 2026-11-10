using Bifrost.Workflows.Contracts;

namespace Bifrost.Workflows.Events;

public sealed record WorkflowCreated
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required IReadOnlyList<WorkflowNode> Nodes { get; init; }
}
