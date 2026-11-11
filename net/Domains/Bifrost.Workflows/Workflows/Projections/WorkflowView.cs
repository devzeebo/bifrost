using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Events;
using JasperFx.Events;
using Marten.Events.Aggregation;

namespace Bifrost.Workflows.Projections;

public class WorkflowView : SingleStreamProjection<WorkflowView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public long Version { get; init; }
        public required string Name { get; init; }
        public required IReadOnlyList<WorkflowNode> Nodes { get; init; }
        public IReadOnlyList<WorkflowConnection> Connections { get; init; } = [];
        public bool IsDeleted { get; init; }
    }

    public Model Create(IEvent<WorkflowCreated> e) =>
        new()
        {
            Id = e.Data.Id,
            Version = e.Version,
            Name = e.Data.Name,
            Nodes = e.Data.Nodes,
            Connections = e.Data.Connections,
            IsDeleted = false,
        };

    public Model Apply(IEvent<WorkflowSaved> e, Model view) =>
        view with
        {
            Version = e.Version,
            Name = e.Data.Name,
            Nodes = e.Data.Nodes,
            Connections = e.Data.Connections,
        };

    public Model Apply(IEvent<WorkflowDeleted> e, Model view) =>
        view with
        {
            Version = e.Version,
            IsDeleted = true,
        };
}
