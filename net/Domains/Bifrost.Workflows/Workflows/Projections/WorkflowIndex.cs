using Bifrost.Workflows.Events;
using Marten.Events.Aggregation;

namespace Bifrost.Workflows.Projections;

public class WorkflowIndex : SingleStreamProjection<WorkflowIndex.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required string Name { get; init; }
        public bool IsDeleted { get; init; }
    }

    public Model Create(WorkflowCreated e) =>
        new()
        {
            Id = e.Id,
            Name = e.Name,
            IsDeleted = false,
        };

    public Model Apply(WorkflowSaved e, Model view) => view with { Name = e.Name };

    public Model Apply(WorkflowDeleted _, Model view) => view with { IsDeleted = true };
}
