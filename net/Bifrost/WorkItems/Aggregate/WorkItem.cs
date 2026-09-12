using System.Text.Json.Nodes;
using Bifrost.WorkItems.Events;

namespace Bifrost.WorkItems.Aggregate;

public class WorkItem
{
    public Guid Id { get; set; }
    public required JsonNode Data { get; set; }
    public List<Edge> Relationships { get; set; } = [];
    public bool IsDeleted { get; set; }

    public sealed record Edge
    {
        public required Guid RelationshipTypeId { get; init; }
        public required RelationshipDirection Direction { get; init; }
        public required Guid RelatedWorkItemId { get; init; }
    }

    public void Apply(WorkItemCreated e)
    {
        Id = e.Id;
        Data = e.Data.DeepClone()!;
        IsDeleted = false;
    }

    public void Apply(WorkItemDataReplaced e)
    {
        Data = e.Data.DeepClone()!;
    }

    public void Apply(RelationshipAdded e)
    {
        var edge = new Edge
        {
            RelationshipTypeId = e.RelationshipTypeId,
            Direction = e.Direction,
            RelatedWorkItemId = e.RelatedWorkItemId,
        };
        if (!Relationships.Contains(edge))
        {
            Relationships.Add(edge);
        }
    }

    public void Apply(RelationshipRemoved e)
    {
        Relationships.RemoveAll(r =>
            r.RelationshipTypeId == e.RelationshipTypeId
            && r.Direction == e.Direction
            && r.RelatedWorkItemId == e.RelatedWorkItemId
        );
    }

    public void Apply(WorkItemDeleted _)
    {
        IsDeleted = true;
        Relationships.Clear();
    }

    public bool HasEdge(
        Guid relationshipTypeId,
        RelationshipDirection direction,
        Guid relatedWorkItemId
    ) =>
        Relationships.Any(r =>
            r.RelationshipTypeId == relationshipTypeId
            && r.Direction == direction
            && r.RelatedWorkItemId == relatedWorkItemId
        );
}
