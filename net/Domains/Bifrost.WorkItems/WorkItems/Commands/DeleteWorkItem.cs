using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Marten;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.WorkItems.Commands;

public static class DeleteWorkItemHandler
{
    public static void Validate(DeleteWorkItemApi.Command command, WorkItem workItem)
    {
        if (workItem.IsDeleted)
        {
            throw new CommandValidationException("Work item is already deleted.");
        }

        workItem.EnsureExpected(command.Expected);
    }

    [WolverinePost("/delete-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<MartenEvents> Handle(
        DeleteWorkItemApi.Command command,
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
                    Actor = command.Actor,
                    Reason = command.Reason,
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
                        Actor = command.Actor,
                        Reason = command.Reason,
                    }
                );
            }
        }

        events.Add(new WorkItemDeleted { Actor = command.Actor, Reason = command.Reason });
        return events;
    }

    static RelationshipDirection Flip(RelationshipDirection direction) =>
        direction == RelationshipDirection.Forward
            ? RelationshipDirection.Inverse
            : RelationshipDirection.Forward;
}
