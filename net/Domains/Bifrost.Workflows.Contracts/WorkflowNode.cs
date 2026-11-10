using System.Text.Json.Nodes;

namespace Bifrost.Workflows.Contracts;

public sealed record WorkflowPort
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
}

public sealed record NodeDefinition
{
    public string? Style { get; init; }
    public JsonNode? Spec { get; init; }
}

public sealed record WorkflowNode
{
    public required Guid Id { get; init; }
    public required IReadOnlyList<WorkflowPort> Inputs { get; init; }
    public required IReadOnlyList<WorkflowPort> Outputs { get; init; }
    public NodeDefinition? Definition { get; init; }
}

/// <summary>Reserved for #118; Get returns an empty list until connections land.</summary>
public sealed record WorkflowConnection;
