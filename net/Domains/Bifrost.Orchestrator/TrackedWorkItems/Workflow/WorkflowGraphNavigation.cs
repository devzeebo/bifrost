using System.Text.Json.Nodes;
using Bifrost.Workflows.Contracts;

namespace Bifrost.TrackedWorkItems.Workflow;

public static class WorkflowGraphNavigation
{
    public static WorkflowNode RequireWorkItemInput(WorkflowSnapshot snapshot)
    {
        var inputs = snapshot.Nodes.Where(WorkItemInputDefaults.IsWorkItemInput).ToList();
        if (inputs.Count != 1)
        {
            throw new InvalidOperationException(
                $"Workflow snapshot {snapshot.Id} must have exactly one work-item-input node."
            );
        }

        return inputs[0];
    }

    public static JsonNode RequireInputSchema(WorkflowNode workItemInput)
    {
        if (
            workItemInput.Definition?.Spec is JsonObject spec
            && spec.TryGetPropertyValue("inputSchema", out var schema)
            && schema is not null
        )
        {
            return schema;
        }

        return WorkItemInputDefaults.DefaultInputSchema.DeepClone()!;
    }

    public static IReadOnlyDictionary<Guid, WorkflowPort> PortsById(WorkflowSnapshot snapshot)
    {
        var map = new Dictionary<Guid, WorkflowPort>();
        foreach (var node in snapshot.Nodes)
        {
            foreach (var port in node.Inputs)
            {
                map[port.Id] = port;
            }

            foreach (var port in node.Outputs)
            {
                map[port.Id] = port;
            }
        }

        return map;
    }

    public static IReadOnlyDictionary<Guid, WorkflowNode> NodesByPortId(WorkflowSnapshot snapshot)
    {
        var map = new Dictionary<Guid, WorkflowNode>();
        foreach (var node in snapshot.Nodes)
        {
            foreach (var port in node.Inputs)
            {
                map[port.Id] = node;
            }

            foreach (var port in node.Outputs)
            {
                map[port.Id] = node;
            }
        }

        return map;
    }

    /// <summary>
    /// Ready runnable nodes (not work-item-input) whose every inbound connection is satisfied,
    /// excluding nodes already issued. Ordered by snapshot node order for serial fan-out.
    /// </summary>
    public static IReadOnlyList<WorkflowNode> ReadyNodes(
        WorkflowSnapshot snapshot,
        IReadOnlySet<Guid> issuedNodeIds,
        IReadOnlyDictionary<Guid, JsonNode?> concludedOutputsByPortId
    )
    {
        var ready = new List<WorkflowNode>();

        foreach (var node in snapshot.Nodes)
        {
            if (WorkItemInputDefaults.IsWorkItemInput(node) || issuedNodeIds.Contains(node.Id))
            {
                continue;
            }

            var inbound = snapshot
                .Connections.Where(c => node.Inputs.Any(p => p.Id == c.InputPortId))
                .ToList();
            if (inbound.Count == 0)
            {
                continue;
            }

            if (inbound.All(c => concludedOutputsByPortId.ContainsKey(c.OutputPortId)))
            {
                ready.Add(node);
            }
        }

        return ready;
    }

    public static JsonObject BuildIssuedInputs(
        WorkflowNode node,
        WorkflowSnapshot snapshot,
        IReadOnlyDictionary<Guid, JsonNode?> concludedOutputsByPortId
    )
    {
        var nodesByPort = NodesByPortId(snapshot);
        var portsById = PortsById(snapshot);
        var inputs = new JsonObject();

        foreach (var connection in snapshot.Connections.Where(c =>
            node.Inputs.Any(p => p.Id == c.InputPortId)
        ))
        {
            var inputPort = portsById[connection.InputPortId];
            var sourceNode = nodesByPort[connection.OutputPortId];
            var sourcePort = portsById[connection.OutputPortId];
            concludedOutputsByPortId.TryGetValue(connection.OutputPortId, out var value);

            inputs[inputPort.Id.ToString("D")] = new JsonObject
            {
                ["portId"] = inputPort.Id.ToString("D"),
                ["portName"] = inputPort.Name,
                ["value"] = value?.DeepClone(),
                ["from"] = new JsonObject
                {
                    ["nodeId"] = sourceNode.Id.ToString("D"),
                    ["nodeName"] = sourceNode.Name,
                    ["outputPortId"] = sourcePort.Id.ToString("D"),
                    ["outputPortName"] = sourcePort.Name,
                },
            };
        }

        return inputs;
    }

    public static JsonObject BuildNodeWorkItemData(WorkflowNode node, JsonObject issuedInputs)
    {
        var definition = node.Definition ?? new NodeDefinition();
        var inputsByName = new JsonObject();
        foreach (var property in issuedInputs)
        {
            if (property.Value is not JsonObject entry)
            {
                continue;
            }

            var portName = entry["portName"]?.GetValue<string>() ?? property.Key;
            inputsByName[portName] = entry["value"]?.DeepClone();
        }

        return new JsonObject
        {
            ["node"] = new JsonObject
            {
                ["id"] = node.Id.ToString("D"),
                ["name"] = node.Name,
                ["style"] = definition.Style,
                ["spec"] = definition.Spec?.DeepClone(),
            },
            ["inputs"] = inputsByName,
        };
    }

    public static JsonObject RecordProducedOutputs(WorkflowNode node, JsonNode workItemData)
    {
        var outputs = new JsonObject();
        JsonNode? defaultValue = workItemData;
        if (
            workItemData is JsonObject dataObj
            && dataObj.TryGetPropertyValue("outputs", out var explicitOutputs)
            && explicitOutputs is JsonObject named
        )
        {
            foreach (var port in node.Outputs)
            {
                if (named.TryGetPropertyValue(port.Name, out var byName) && byName is not null)
                {
                    outputs[port.Id.ToString("D")] = byName.DeepClone();
                }
                else if (
                    named.TryGetPropertyValue(port.Id.ToString("D"), out var byId)
                    && byId is not null
                )
                {
                    outputs[port.Id.ToString("D")] = byId.DeepClone();
                }
            }

            return outputs;
        }

        foreach (var port in node.Outputs)
        {
            outputs[port.Id.ToString("D")] = defaultValue?.DeepClone();
        }

        return outputs;
    }
}
