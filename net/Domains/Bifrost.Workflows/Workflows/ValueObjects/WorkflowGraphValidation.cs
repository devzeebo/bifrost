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
        var nodeIds = new HashSet<Guid>();
        var portIds = new HashSet<Guid>();
        var outputPorts = new Dictionary<Guid, (WorkflowNode Node, WorkflowPort Port)>();
        var inputPorts = new Dictionary<Guid, (WorkflowNode Node, WorkflowPort Port)>();
        var normalizedNodes = new List<WorkflowNode>(nodes.Count);

        foreach (var node in nodes)
        {
            if (!nodeIds.Add(node.Id))
            {
                throw new CommandValidationException($"Duplicate node id '{node.Id}'.");
            }

            if (node.Definition is null)
            {
                throw new CommandValidationException(
                    $"Node '{node.Id}' is missing a definition."
                );
            }

            if (string.IsNullOrWhiteSpace(node.Definition.Style))
            {
                throw new CommandValidationException(
                    $"Node '{node.Id}' is missing a definition style."
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

            var normalizedInputs = NormalizePorts(node, node.Inputs, inputPorts, portIds);
            var normalizedOutputs = NormalizePorts(node, node.Outputs, outputPorts, portIds);

            normalizedNodes.Add(
                node with
                {
                    Definition = new NodeDefinition
                    {
                        Style = style.Value,
                        Spec = node.Definition.Spec?.DeepClone(),
                    },
                    Inputs = normalizedInputs,
                    Outputs = normalizedOutputs,
                }
            );
        }

        var normalizedConnections = ValidateConnections(
            connections,
            inputPorts,
            outputPorts
        );

        return new Result(normalizedNodes, normalizedConnections);
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
                    $"Node '{node.Id}' has a port with an empty name."
                );
            }

            if (!portIds.Add(port.Id))
            {
                throw new CommandValidationException(
                    $"Duplicate port id '{port.Id}' in workflow."
                );
            }

            PortSchemaCompatibility.EnsureParseable(port.Schema, node.Id, port.Id);

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
                    $"Connection '{connection.Id}' output port '{connection.OutputPortId}' is not an output of a node in this workflow."
                );
            }

            if (!inputPorts.TryGetValue(connection.InputPortId, out var input))
            {
                throw new CommandValidationException(
                    $"Connection '{connection.Id}' input port '{connection.InputPortId}' is not an input of a node in this workflow."
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

    static void RejectCycles(Dictionary<Guid, List<Guid>> adjacency)
    {
        var visiting = new HashSet<Guid>();
        var visited = new HashSet<Guid>();

        foreach (var nodeId in adjacency.Keys)
        {
            if (HasCycle(nodeId, adjacency, visiting, visited))
            {
                throw new CommandValidationException(
                    "Workflow connections form a cycle; cycles are rejected at save."
                );
            }
        }
    }

    static bool HasCycle(
        Guid nodeId,
        Dictionary<Guid, List<Guid>> adjacency,
        HashSet<Guid> visiting,
        HashSet<Guid> visited
    )
    {
        if (visited.Contains(nodeId))
        {
            return false;
        }

        if (!visiting.Add(nodeId))
        {
            return true;
        }

        if (adjacency.TryGetValue(nodeId, out var targets))
        {
            foreach (var target in targets)
            {
                if (HasCycle(target, adjacency, visiting, visited))
                {
                    return true;
                }
            }
        }

        visiting.Remove(nodeId);
        visited.Add(nodeId);
        return false;
    }
}
