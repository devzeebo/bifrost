using Bifrost.WorkItems.Events;
using Marten.Events.Aggregation;

namespace Bifrost.WorkItems.Projections;

public class WorkItemIndex : SingleStreamProjection<WorkItemIndex.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required string Status { get; init; }
        public bool IsDeleted { get; init; }
    }

    public Model Create(WorkItemCreated e) =>
        new()
        {
            Id = e.Id,
            Status = e.Status.Value,
            IsDeleted = false,
        };

    public Model Apply(WorkItemStatusChanged e, Model view) =>
        view with
        {
            Status = e.Status.Value,
        };

    public Model Apply(WorkItemDeleted _, Model view) => view with { IsDeleted = true };
}
