using System.Text.Json.Nodes;
using Bifrost.Domain.WorkItems.Events;
using Marten.Events.Aggregation;

namespace Bifrost.Domain.WorkItems.Projections;

public class WorkItemView : SingleStreamProjection<WorkItemView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required JsonNode Data { get; init; }
        public IReadOnlyList<Relationship> Relationships { get; init; } = [];
        public bool IsDeleted { get; init; }
    }

    public sealed record Relationship
    {
        public required Guid RelationshipTypeId { get; init; }
        public required string Word { get; init; }
        public required RelationshipDirection Direction { get; init; }
        public required Guid RelatedWorkItemId { get; init; }
    }

    public Model Create(WorkItemCreated e) =>
        new()
        {
            Id = e.Id,
            Data = e.Data.DeepClone()!,
            IsDeleted = false,
        };

    public Model Apply(WorkItemDataReplaced e, Model view) =>
        view with
        {
            Data = e.Data.DeepClone()!,
        };

    public Model Apply(RelationshipAdded e, Model view)
    {
        if (
            view.Relationships.Any(r =>
                r.RelationshipTypeId == e.RelationshipTypeId
                && r.Direction == e.Direction
                && r.RelatedWorkItemId == e.RelatedWorkItemId
            )
        )
        {
            return view;
        }

        return view with
        {
            Relationships =
            [
                .. view.Relationships,
                new Relationship
                {
                    RelationshipTypeId = e.RelationshipTypeId,
                    Word = e.Word,
                    Direction = e.Direction,
                    RelatedWorkItemId = e.RelatedWorkItemId,
                },
            ],
        };
    }

    public Model Apply(RelationshipRemoved e, Model view) =>
        view with
        {
            Relationships =
            [
                .. view.Relationships.Where(r =>
                    r.RelationshipTypeId != e.RelationshipTypeId
                    || r.Direction != e.Direction
                    || r.RelatedWorkItemId != e.RelatedWorkItemId
                ),
            ],
        };

    public Model Apply(WorkItemDeleted _, Model view) =>
        view with
        {
            IsDeleted = true,
            Relationships = [],
        };
}
