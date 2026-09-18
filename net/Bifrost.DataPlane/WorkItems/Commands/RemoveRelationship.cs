using Bifrost.RelationshipTypes;
using Bifrost.RelationshipTypes.Projections;
using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Marten;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.WorkItems.Commands;

public static class RemoveRelationshipHandler
{
    public static async Task Validate(RemoveRelationshipApi.Command command, WorkItem workItem, IQuerySession session)
    {
        if (workItem.IsDeleted)
        {
            throw new CommandValidationException("Work item is deleted.");
        }

        RelationshipTypeWord word = command.Word;
        var byWord = await session.LoadAsync<RelationshipTypeByWord.Model>(word.Value);
        if (byWord is null)
        {
            throw new CommandValidationException($"Unknown relationship word '{command.Word}'.");
        }

        if (
            !workItem.HasEdge(
                byWord.RelationshipTypeId,
                byWord.Direction,
                command.RelatedWorkItemId
            )
        )
        {
            throw new CommandValidationException("Relationship does not exist on this work item.");
        }
    }
    [AggregateHandler]
    public static async Task<MartenEvents> Handle(
        RemoveRelationshipApi.Command command,
        WorkItem workItem,
        IDocumentSession session
    )
    {
        RelationshipTypeWord word = command.Word;
        var byWord = (await session.LoadAsync<RelationshipTypeByWord.Model>(word.Value))!;
        var inverseDirection = Flip(byWord.Direction);

        var related = await session.Events.FetchForWriting<WorkItem>(command.RelatedWorkItemId);
        if (
            related.Aggregate!.HasEdge(
                byWord.RelationshipTypeId,
                inverseDirection,
                command.WorkItemId
            )
        )
        {
            related.AppendOne(
                new RelationshipRemoved
                {
                    RelationshipTypeId = byWord.RelationshipTypeId,
                    Direction = inverseDirection,
                    RelatedWorkItemId = command.WorkItemId,
                }
            );
        }

        return
        [
            new RelationshipRemoved
            {
                RelationshipTypeId = byWord.RelationshipTypeId,
                Direction = byWord.Direction,
                RelatedWorkItemId = command.RelatedWorkItemId,
            },
        ];
    }

    static RelationshipDirection Flip(RelationshipDirection direction) =>
        direction == RelationshipDirection.Forward
            ? RelationshipDirection.Inverse
            : RelationshipDirection.Forward;
}
