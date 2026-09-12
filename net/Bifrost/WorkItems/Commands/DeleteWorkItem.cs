using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Marten;
using Wolverine.Http;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.WorkItems.Commands;

public static class DeleteWorkItemHandler
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }

    public static void Validate(Command command, WorkItem workItem)
    {
        if (workItem.IsDeleted)
        {
            throw new CommandValidationException("Work item is already deleted.");
        }
    }

    [WolverinePost("/delete-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<MartenEvents> Handle(
        Command command,
        WorkItem workItem,
        IDocumentSession session
    )
    {
        var events = new MartenEvents();

        foreach (var edge in workItem.Relationships.ToArray())
        {
            events.Add(
                new RelationshipRemoved
                {
                    RelationshipTypeId = edge.RelationshipTypeId,
                    Direction = edge.Direction,
                    RelatedWorkItemId = edge.RelatedWorkItemId,
                }
            );

            var inverseDirection = Flip(edge.Direction);
            var related = await session.Events.FetchForWriting<WorkItem>(edge.RelatedWorkItemId);
            if (
                related.Aggregate is { IsDeleted: false } aggregate
                && aggregate.HasEdge(edge.RelationshipTypeId, inverseDirection, workItem.Id)
            )
            {
                related.AppendOne(
                    new RelationshipRemoved
                    {
                        RelationshipTypeId = edge.RelationshipTypeId,
                        Direction = inverseDirection,
                        RelatedWorkItemId = workItem.Id,
                    }
                );
            }
        }

        events.Add(new WorkItemDeleted());
        return events;
    }

    static RelationshipDirection Flip(RelationshipDirection direction) =>
        direction == RelationshipDirection.Forward
            ? RelationshipDirection.Inverse
            : RelationshipDirection.Forward;
}
