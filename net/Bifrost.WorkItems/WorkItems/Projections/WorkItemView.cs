using System.Text.Json.Nodes;
using Bifrost.RelationshipTypes.Events;
using Bifrost.WorkItems.Events;
using JasperFx.Events;
using JasperFx.Events.Grouping;
using Marten;
using Marten.Events.Projections;

namespace Bifrost.WorkItems.Projections;

public class WorkItemView : MultiStreamProjection<WorkItemView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required JsonNode Data { get; init; }
        public required WorkItemStatus Status { get; init; }
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

    public WorkItemView()
    {
        Name = nameof(WorkItemView);

        Identity<IEvent<WorkItemCreated>>(e => e.StreamId);
        Identity<IEvent<WorkItemDataReplaced>>(e => e.StreamId);
        Identity<IEvent<WorkItemStatusChanged>>(e => e.StreamId);
        Identity<IEvent<RelationshipAdded>>(e => e.StreamId);
        Identity<IEvent<RelationshipRemoved>>(e => e.StreamId);
        Identity<IEvent<WorkItemDeleted>>(e => e.StreamId);

        CustomGrouping(GroupWordsChanged);
    }

    static async Task GroupWordsChanged(
        IQuerySession session,
        IReadOnlyList<IEvent> events,
        IEventGrouping<Guid> grouping
    )
    {
        var changed = events.OfType<IEvent<RelationshipTypeWordsChanged>>().ToList();
        if (changed.Count == 0)
        {
            return;
        }

        var typeIds = changed.Select(e => e.Data.RelationshipTypeId).Distinct().ToArray();

        var items = await session
            .Query<Model>()
            .Where(x => x.Relationships.Any(r => typeIds.Contains(r.RelationshipTypeId)))
            .ToListAsync();

        var workItemIdsByType = items
            .SelectMany(item =>
                item.Relationships.Select(edge => (edge.RelationshipTypeId, item.Id))
            )
            .GroupBy(x => x.RelationshipTypeId, x => x.Id)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Guid>)g.Distinct().ToArray());

        grouping.AddEvents<RelationshipTypeWordsChanged>(
            e =>
                workItemIdsByType.TryGetValue(e.RelationshipTypeId, out var ids)
                    ? ids
                    : Array.Empty<Guid>(),
            changed
        );
    }

    public Model Create(WorkItemCreated e) =>
        new()
        {
            Id = e.Id,
            Data = e.Data.DeepClone()!,
            Status = e.Status,
            IsDeleted = false,
        };

    public Model Apply(WorkItemDataReplaced e, Model view) =>
        view with
        {
            Data = e.Data.DeepClone()!,
        };

    public Model Apply(WorkItemStatusChanged e, Model view) => view with { Status = e.Status };

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

    public Model Apply(RelationshipTypeWordsChanged e, Model view) =>
        view with
        {
            Relationships =
            [
                .. view.Relationships.Select(edge =>
                    edge.RelationshipTypeId != e.RelationshipTypeId
                        ? edge
                        : edge with
                        {
                            Word =
                                edge.Direction == RelationshipDirection.Forward
                                    ? e.ForwardWord.Value
                                    : e.InverseWord.Value,
                        }
                ),
            ],
        };
}
