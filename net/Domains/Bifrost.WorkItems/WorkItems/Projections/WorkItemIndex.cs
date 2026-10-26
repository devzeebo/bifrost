using System.Text.Json.Nodes;
using Bifrost.WorkItems.Events;
using Marten.Events.Aggregation;

namespace Bifrost.WorkItems.Projections;

public class WorkItemIndex : SingleStreamProjection<WorkItemIndex.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required string Status { get; init; }
        public required JsonObject Metadata { get; init; }
        public bool IsDeleted { get; init; }
    }

    public Model Create(WorkItemCreated e) =>
        new()
        {
            Id = e.Id,
            Status = e.Status.Value,
            Metadata = new JsonObject(),
            IsDeleted = false,
        };

    public Model Apply(WorkItemStatusChanged e, Model view) =>
        view with
        {
            Status = e.Status.Value,
        };

    public Model Apply(WorkItemMetadataReplaced e, Model view) =>
        view with
        {
            Metadata = (JsonObject)e.Metadata.DeepClone()!,
        };

    public Model Apply(WorkItemDeleted _, Model view) => view with { IsDeleted = true };
}
