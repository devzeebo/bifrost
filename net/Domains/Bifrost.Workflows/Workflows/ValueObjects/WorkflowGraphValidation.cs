using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost.Workflows.Contracts;

namespace Bifrost.Workflows.ValueObjects;

public static class WorkflowGraphValidation
{
    public sealed record Result(
        IReadOnlyList<WorkflowNode> Nodes,
        IReadOnlyList<WorkflowConnection> Connections
    );

    public static Result Validate(
        string name,
        IReadOnlyList<WorkflowNode>? nodes,
        IReadOnlyList<WorkflowConnection>? connections = null
    )
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new CommandValidationException("Workflow name is required.");
        }

        nodes ??= [];
        connections ??= [];
        if (nodes.Count == 0)
        {
            nodes = [WorkItemInputDefaults.CreateNode()];
        }

        var nodeIds = new HashSet<Guid>();
        var portIds = new HashSet<Guid>();
        var outputPorts = new Dictionary<Guid, (WorkflowNode Node, WorkflowPort Port)>();
        var inputPorts = new Dictionary<Guid, (WorkflowNode Node, WorkflowPort Port)>();
        var normalizedNodes = new List<WorkflowNode>(nodes.Count);
        var workItemInputCount = 0;

        foreach (var node in nodes)
        {
            if (!nodeIds.Add(node.Id))
            {
                throw new CommandValidationException($"Duplicate node id '{node.Id}'.");
            }

            if (string.IsNullOrWhiteSpace(node.Name))
            {
                throw new CommandValidationException(
                    $"Node '{node.Id}' is missing a name."
                );
            }

            if (node.Position is null)
            {
                throw new CommandValidationException(
                    $"Node '{Describe(node)}' is missing a position."
                );
            }

            if (node.Definition is null)
            {
                throw new CommandValidationException(
                    $"Node '{Describe(node)}' is missing a definition."
                );
            }

            if (string.IsNullOrWhiteSpace(node.Definition.Style))
            {
                throw new CommandValidationException(
                    $"Node '{Describe(node)}' is missing a definition style."
                );
            }

            DefinitionStyle style;
            try
            {
                style = new DefinitionStyle(node.Definition.Style);
            }
            catch (ContractValidationException ex)
            {
                throw new CommandValidationException(ex.Message);
            }

            var normalizedSpec = NormalizeDefinitionSpec(node, style, node.Definition.Spec);

            IReadOnlyList<WorkflowPort> normalizedInputs;
            IReadOnlyList<WorkflowPort> normalizedOutputs;
            if (style.Value == DefinitionStyle.WorkItemInput)
            {
                workItemInputCount++;
                (normalizedInputs, normalizedOutputs) = NormalizeWorkItemInputPorts(
                    node,
                    outputPorts,
                    portIds
                );
            }
            else
            {
                normalizedInputs = NormalizePorts(node, node.Inputs, inputPorts, portIds);
                normalizedOutputs = NormalizePorts(node, node.Outputs, outputPorts, portIds);
            }

            normalizedNodes.Add(
                node with
                {
                    Name = node.Name.Trim(),
                    Position = node.Position,
                    Definition = new NodeDefinition
                    {
                        Style = style.Value,
                        Spec = normalizedSpec,
                    },
                    Inputs = normalizedInputs,
                    Outputs = normalizedOutputs,
                }
            );
        }

        if (workItemInputCount == 0)
        {
            throw new CommandValidationException(
                "Workflow must include exactly one work-item-input node."
            );
        }

        if (workItemInputCount > 1)
        {
            throw new CommandValidationException(
                "Workflow must include exactly one work-item-input node."
            );
        }

        var normalizedConnections = ValidateConnections(
            connections,
            inputPorts,
            outputPorts
        );

        return new Result(normalizedNodes, normalizedConnections);
    }

    public const string BifrostNodeImage = "bifrost/node";

    static (IReadOnlyList<WorkflowPort> Inputs, IReadOnlyList<WorkflowPort> Outputs) NormalizeWorkItemInputPorts(
        WorkflowNode node,
        Dictionary<Guid, (WorkflowNode Node, WorkflowPort Port)> outputPorts,
        HashSet<Guid> portIds
    )
    {
        if (node.Inputs is { Count: > 0 })
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' is a work-item-input and cannot have input ports."
            );
        }

        if (node.Outputs is not { Count: 1 })
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' is a work-item-input and must have exactly one output port."
            );
        }

        var port = node.Outputs[0];
        if (string.IsNullOrWhiteSpace(port.Name))
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' has a port with an empty name."
            );
        }

        if (!portIds.Add(port.Id))
        {
            throw new CommandValidationException($"Duplicate port id '{port.Id}' in workflow.");
        }

        if (!JsonNode.DeepEquals(port.Schema, WorkItemInputDefaults.OutputSchema))
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' work-item-input output schema is fixed and cannot be changed."
            );
        }

        var cloned = port with
        {
            Name = port.Name.Trim(),
            Schema = WorkItemInputDefaults.OutputSchema.DeepClone()!,
        };
        outputPorts[cloned.Id] = (node, cloned);
        return ([], [cloned]);
    }

    static JsonNode? NormalizeDefinitionSpec(
        WorkflowNode node,
        DefinitionStyle style,
        JsonNode? spec
    )
    {
        if (style.Value == DefinitionStyle.WorkItemInput)
        {
            return NormalizeWorkItemInputSpec(node, spec);
        }

        if (style.Value != DefinitionStyle.Script)
        {
            return spec?.DeepClone();
        }

        if (spec is not JsonObject scriptSpec)
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' script definition requires a spec object with 'image' and 'body'."
            );
        }

        if (
            !scriptSpec.TryGetPropertyValue("body", out var bodyNode)
            || bodyNode is null
            || bodyNode.GetValueKind() != JsonValueKind.String
        )
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' script definition requires a string 'body'."
            );
        }

        var body = bodyNode.GetValue<string>();
        if (string.IsNullOrWhiteSpace(body))
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' script definition requires a non-empty 'body'."
            );
        }

        if (
            !scriptSpec.TryGetPropertyValue("image", out var imageNode)
            || imageNode is null
            || imageNode.GetValueKind() != JsonValueKind.String
        )
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' script definition requires a string 'image'."
            );
        }

        var image = imageNode.GetValue<string>().Trim();
        if (image != BifrostNodeImage)
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' script image '{image}' is not supported. Expected '{BifrostNodeImage}'."
            );
        }

        var normalized = scriptSpec.DeepClone()!.AsObject();
        normalized["image"] = BifrostNodeImage;
        normalized["body"] = body;
        return normalized;
    }

    static JsonNode NormalizeWorkItemInputSpec(WorkflowNode node, JsonNode? spec)
    {
        if (spec is not JsonObject specObject)
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' work-item-input definition requires a spec object with 'inputSchema'."
            );
        }

        if (
            !specObject.TryGetPropertyValue("inputSchema", out var inputSchema)
            || inputSchema is null
        )
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' work-item-input definition requires 'inputSchema'."
            );
        }

        if (inputSchema is not JsonValue and not JsonObject)
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' inputSchema must be a JSON Schema object or boolean."
            );
        }

        try
        {
            _ = PortSchemaCompatibility.ParseWithoutRegistering(inputSchema);
        }
        catch (Exception ex)
        {
            throw new CommandValidationException(
                $"Node '{Describe(node)}' inputSchema is not a valid JSON Schema: {ex.Message}"
            );
        }

        var normalized = new JsonObject { ["inputSchema"] = inputSchema.DeepClone()! };
        return normalized;
    }

    static IReadOnlyList<WorkflowPort> NormalizePorts(
        WorkflowNode node,
        IReadOnlyList<WorkflowPort> ports,
        Dictionary<Guid, (WorkflowNode Node, WorkflowPort Port)> byRole,
        HashSet<Guid> portIds
    )
    {
        var normalized = new List<WorkflowPort>(ports.Count);
        foreach (var port in ports)
        {
            if (string.IsNullOrWhiteSpace(port.Name))
            {
                throw new CommandValidationException(
                    $"Node '{Describe(node)}' has a port with an empty name."
                );
            }

            if (!portIds.Add(port.Id))
            {
                throw new CommandValidationException(
                    $"Duplicate port id '{port.Id}' in workflow."
                );
            }

            PortSchemaCompatibility.EnsureParseable(port.Schema, node, port);

            var cloned = port with { Schema = port.Schema.DeepClone() };
            byRole[cloned.Id] = (node, cloned);
            normalized.Add(cloned);
        }

        return normalized;
    }

    static IReadOnlyList<WorkflowConnection> ValidateConnections(
        IReadOnlyList<WorkflowConnection> connections,
        Dictionary<Guid, (WorkflowNode Node, WorkflowPort Port)> inputPorts,
        Dictionary<Guid, (WorkflowNode Node, WorkflowPort Port)> outputPorts
    )
    {
        var connectionIds = new HashSet<Guid>();
        var usedInputs = new HashSet<Guid>();
        var edges = new HashSet<(Guid OutputPortId, Guid InputPortId)>();
        var adjacency = new Dictionary<Guid, List<Guid>>();
        var normalized = new List<WorkflowConnection>(connections.Count);

        foreach (var connection in connections)
        {
            if (!connectionIds.Add(connection.Id))
            {
                throw new CommandValidationException(
                    $"Duplicate connection id '{connection.Id}'."
                );
            }

            if (!outputPorts.TryGetValue(connection.OutputPortId, out var output))
            {
                throw new CommandValidationException(
                    DescribeMissingOrWrongKind(
                        connection.Id,
                        connection.OutputPortId,
                        expectedKind: "output",
                        otherRolePorts: inputPorts,
                        otherKind: "input"
                    )
                );
            }

            if (!inputPorts.TryGetValue(connection.InputPortId, out var input))
            {
                throw new CommandValidationException(
                    DescribeMissingOrWrongKind(
                        connection.Id,
                        connection.InputPortId,
                        expectedKind: "input",
                        otherRolePorts: outputPorts,
                        otherKind: "output"
                    )
                );
            }

            if (!usedInputs.Add(connection.InputPortId))
            {
                throw new CommandValidationException(
                    $"Input port '{connection.InputPortId}' ('{input.Port.Name}') is already connected; one input may only receive from one output."
                );
            }

            if (!edges.Add((connection.OutputPortId, connection.InputPortId)))
            {
                throw new CommandValidationException(
                    $"Duplicate connection from output '{connection.OutputPortId}' to input '{connection.InputPortId}'."
                );
            }

            if (
                !PortSchemaCompatibility.OutputSatisfiesInput(
                    output.Port.Schema,
                    input.Port.Schema,
                    out var reason
                )
            )
            {
                throw new CommandValidationException(
                    $"Connection '{connection.Id}' from output '{output.Port.Name}' ({connection.OutputPortId}) to input '{input.Port.Name}' ({connection.InputPortId}) is rejected: {reason}."
                );
            }

            if (!adjacency.TryGetValue(output.Node.Id, out var targets))
            {
                targets = [];
                adjacency[output.Node.Id] = targets;
            }

            targets.Add(input.Node.Id);
            normalized.Add(connection);
        }

        RejectCycles(adjacency);
        return normalized;
    }

    static string Describe(WorkflowNode node) =>
        string.IsNullOrWhiteSpace(node.Name) ? node.Id.ToString() : $"{node.Name.Trim()} ({node.Id})";

    static string DescribeMissingOrWrongKind(
        Guid connectionId,
        Guid portId,
        string expectedKind,
        Dictionary<Guid, (WorkflowNode Node, WorkflowPort Port)> otherRolePorts,
        string otherKind
    )
    {
        if (otherRolePorts.TryGetValue(portId, out var wrongKind))
        {
            return $"Connection '{connectionId}' {expectedKind} port '{portId}' ('{wrongKind.Port.Name}') exists as an {otherKind} on node '{wrongKind.Node.Id}', not an {expectedKind}.";
        }

        return $"Connection '{connectionId}' {expectedKind} port '{portId}' is not an {expectedKind} of a node in this workflow.";
    }

    static void RejectCycles(Dictionary<Guid, List<Guid>> adjacency)
    {
        var visiting = new HashSet<Guid>();
        var visited = new HashSet<Guid>();
        var stack = new List<Guid>();

        foreach (var nodeId in adjacency.Keys)
        {
            if (TryFindCycle(nodeId, adjacency, visiting, visited, stack, out var cycle))
            {
                var chain = string.Join(" -> ", cycle.Select(id => $"'{id}'"));
                throw new CommandValidationException(
                    $"Workflow connections form a cycle involving nodes {chain}; cycles are rejected at save."
                );
            }
        }
    }

    static bool TryFindCycle(
        Guid nodeId,
        Dictionary<Guid, List<Guid>> adjacency,
        HashSet<Guid> visiting,
        HashSet<Guid> visited,
        List<Guid> stack,
        out List<Guid> cycle
    )
    {
        cycle = [];

        if (visited.Contains(nodeId))
        {
            return false;
        }

        if (!visiting.Add(nodeId))
        {
            var start = stack.IndexOf(nodeId);
            cycle = [.. stack.Skip(start), nodeId];
            return true;
        }

        stack.Add(nodeId);

        if (adjacency.TryGetValue(nodeId, out var targets))
        {
            foreach (var target in targets)
            {
                if (TryFindCycle(target, adjacency, visiting, visited, stack, out cycle))
                {
                    return true;
                }
            }
        }

        stack.RemoveAt(stack.Count - 1);
        visiting.Remove(nodeId);
        visited.Add(nodeId);
        return false;
    }
}
