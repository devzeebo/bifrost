using Bifrost.WorkItems.Events;
using Marten.Events.Aggregation;

namespace Bifrost.WorkItems.Projections;

public class WorkItemIndex : SingleStreamProjection<WorkItemIndex.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public bool IsDeleted { get; init; }
    }

    public Model Create(WorkItemCreated e) => new() { Id = e.Id, IsDeleted = false };

    public Model Apply(WorkItemDeleted _, Model view) => view with { IsDeleted = true };
}
