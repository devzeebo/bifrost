using System.Text.Json.Nodes;
using Bifrost.Workflows.Contracts;

namespace Bifrost.Workflows.ValueObjects;

public static class WorkflowGraphValidation
{
    public static IReadOnlyList<WorkflowNode> Validate(string name, IReadOnlyList<WorkflowNode>? nodes)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new CommandValidationException("Workflow name is required.");
        }

        nodes ??= [];
        var nodeIds = new HashSet<Guid>();
        var portIds = new HashSet<Guid>();
        var normalized = new List<WorkflowNode>(nodes.Count);

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

            foreach (var port in node.Inputs.Concat(node.Outputs))
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
            }

            normalized.Add(
                node with
                {
                    Definition = new NodeDefinition
                    {
                        Style = style.Value,
                        Spec = node.Definition.Spec?.DeepClone(),
                    },
                    Inputs = [.. node.Inputs],
                    Outputs = [.. node.Outputs],
                }
            );
        }

        return normalized;
    }
}
