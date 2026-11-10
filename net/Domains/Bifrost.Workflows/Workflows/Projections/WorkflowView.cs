using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Events;
using Marten.Events.Aggregation;

namespace Bifrost.Workflows.Projections;

public class WorkflowView : SingleStreamProjection<WorkflowView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required string Name { get; init; }
        public required IReadOnlyList<WorkflowNode> Nodes { get; init; }
    }

    public Model Create(WorkflowCreated e) =>
        new()
        {
            Id = e.Id,
            Name = e.Name,
            Nodes = e.Nodes,
        };

    public Model Apply(WorkflowSaved e, Model view) =>
        view with
        {
            Name = e.Name,
            Nodes = e.Nodes,
        };
}
