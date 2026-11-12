using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Projections;

namespace Bifrost.Workflows.ValueObjects;

public static class WorkflowStartability
{
    public static void EnsureStartable(WorkflowView.Model workflow)
    {
        ArgumentNullException.ThrowIfNull(workflow);

        var entryNodes = workflow.Nodes.Where(WorkItemInputDefaults.IsWorkItemInput).ToList();
        if (entryNodes.Count != 1)
        {
            throw new CommandValidationException(
                $"Workflow {workflow.Id} names nothing to run: it does not have a work-item-input node."
            );
        }

        var entry = entryNodes[0];
        if (entry.Outputs.Count != 1)
        {
            throw new CommandValidationException(
                $"Workflow {workflow.Id} names nothing to run: its work-item-input node is incomplete."
            );
        }

        var outputPortId = entry.Outputs[0].Id;
        if (!workflow.Connections.Any(connection => connection.OutputPortId == outputPortId))
        {
            throw new CommandValidationException(
                $"Workflow {workflow.Id} names nothing to run: its work-item-input is not connected to a node."
            );
        }
    }
}
