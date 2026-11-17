using System.Text.Json.Nodes;

namespace Bifrost.Workflows.Contracts;

/// <summary>
/// Canonical shape for the non-deletable work-item-input node and the metadata key
/// stamped when a work item is attached to a workflow.
/// </summary>
public static class WorkItemInputDefaults
{
    public const string MetadataWorkflowIdKey = "workflowId";
    public const string MetadataWorkflowSnapshotKey = "workflowSnapshot";
    public const string MetadataWorkflowVersionKey = "workflowVersion";
    public const string MetadataRootWorkItemIdKey = "rootWorkItemId";
    public const string MetadataNodeIdKey = "nodeId";
    public const string MetadataNodeNameKey = "nodeName";
    public const string MetadataIssuedInputsKey = "issuedInputs";
    public const string MetadataProducedOutputsKey = "producedOutputs";
    public const string DefaultNodeName = "Work item";
    public const string OutputPortName = "work item";

    /// <summary>Fixed JSON Schema on the work-item-input output port.</summary>
    public static JsonNode OutputSchema { get; } =
        new JsonObject
        {
            ["$id"] = "bifrost://work-item-output",
            ["title"] = "Work item",
            ["type"] = "object",
        };

    /// <summary>Default Input Schema stored on definition.spec (not a port).</summary>
    public static JsonNode DefaultInputSchema { get; } = JsonValue.Create(true)!;

    public static WorkflowNode CreateNode(
        Guid? nodeId = null,
        Guid? outputPortId = null,
        double x = 40,
        double y = 40,
        JsonNode? inputSchema = null
    )
    {
        var schema = (inputSchema ?? DefaultInputSchema).DeepClone()!;
        return new WorkflowNode
        {
            Id = nodeId ?? Guid.NewGuid(),
            Name = DefaultNodeName,
            Position = new NodePosition { X = x, Y = y },
            Inputs = [],
            Outputs =
            [
                new WorkflowPort
                {
                    Id = outputPortId ?? Guid.NewGuid(),
                    Name = OutputPortName,
                    Schema = OutputSchema.DeepClone()!,
                },
            ],
            Definition = new NodeDefinition
            {
                Style = DefinitionStyle.WorkItemInput,
                Spec = new JsonObject { ["inputSchema"] = schema },
            },
        };
    }

    public static bool IsWorkItemInput(WorkflowNode node) =>
        string.Equals(
            node.Definition?.Style,
            DefinitionStyle.WorkItemInput,
            StringComparison.Ordinal
        );

    public static JsonObject AttachmentMetadata(Guid workflowId) =>
        new() { [MetadataWorkflowIdKey] = workflowId.ToString() };

    public static bool TryReadAttachedWorkflowId(JsonObject? metadata, out Guid workflowId)
    {
        workflowId = default;
        if (
            metadata is null
            || !metadata.TryGetPropertyValue(MetadataWorkflowIdKey, out var node)
            || node is null
        )
        {
            return false;
        }

        if (node.GetValueKind() == System.Text.Json.JsonValueKind.String)
        {
            return Guid.TryParse(node.GetValue<string>(), out workflowId);
        }

        return false;
    }

    public static bool TryReadRootWorkItemId(JsonObject? metadata, out Guid rootWorkItemId)
    {
        rootWorkItemId = default;
        if (
            metadata is null
            || !metadata.TryGetPropertyValue(MetadataRootWorkItemIdKey, out var node)
            || node is null
        )
        {
            return false;
        }

        if (node.GetValueKind() == System.Text.Json.JsonValueKind.String)
        {
            return Guid.TryParse(node.GetValue<string>(), out rootWorkItemId);
        }

        return false;
    }

    public static bool IsAttachedWorkflowRoot(JsonObject? metadata) =>
        TryReadAttachedWorkflowId(metadata, out _) && !TryReadRootWorkItemId(metadata, out _);
}
