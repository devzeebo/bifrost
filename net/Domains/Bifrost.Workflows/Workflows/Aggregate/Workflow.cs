using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Events;

namespace Bifrost.Workflows.Aggregate;

public class Workflow
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public IReadOnlyList<WorkflowNode> Nodes { get; set; } = [];

    public void Apply(WorkflowCreated e)
    {
        Id = e.Id;
        Name = e.Name;
        Nodes = e.Nodes;
    }

    public void Apply(WorkflowSaved e)
    {
        Name = e.Name;
        Nodes = e.Nodes;
    }
}
