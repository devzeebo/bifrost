using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Bifrost.Workflows.Contracts;

namespace Bifrost.TrackedWorkItems.Workflow;

public sealed record WorkflowSnapshot
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required long Version { get; init; }
    public required IReadOnlyList<WorkflowNode> Nodes { get; init; }
    public required IReadOnlyList<WorkflowConnection> Connections { get; init; }

    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static WorkflowSnapshot FromResponse(GetWorkflowApi.Response workflow) =>
        new()
        {
            Id = workflow.Id,
            Name = workflow.Name,
            Version = workflow.Version,
            Nodes = workflow.Nodes,
            Connections = workflow.Connections,
        };

    public JsonObject ToJson() =>
        JsonSerializer.SerializeToNode(this, JsonOptions)!.AsObject();

    public static WorkflowSnapshot? TryRead(JsonObject? metadata)
    {
        if (
            metadata is null
            || !metadata.TryGetPropertyValue(
                WorkItemInputDefaults.MetadataWorkflowSnapshotKey,
                out var node
            )
            || node is null
        )
        {
            return null;
        }

        return JsonSerializer.Deserialize<WorkflowSnapshot>(node, JsonOptions);
    }
}
