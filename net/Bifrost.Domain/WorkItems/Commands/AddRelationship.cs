using Bifrost.Domain.RelationshipTypes.Projections;
using Bifrost.Domain.WorkItems.Aggregate;
using Bifrost.Domain.WorkItems.Events;
using Bifrost.Domain.WorkItems.Projections;
using Marten;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Domain.WorkItems.Commands;

public static class AddRelationshipHandler
{
    public sealed record Command
    {
        public required Guid WorkItemId { get; init; }
        public required string Word { get; init; }
        public required Guid RelatedWorkItemId { get; init; }
    }

    public static async Task Validate(Command command, WorkItem workItem, IQuerySession session)
    {
        if (workItem.IsDeleted)
        {
            throw new CommandValidationException("Work item is deleted.");
        }

        if (command.RelatedWorkItemId == command.WorkItemId)
        {
            throw new CommandValidationException("A work item cannot relate to itself.");
        }

        var related = await session.LoadAsync<WorkItemView.Model>(command.RelatedWorkItemId);
        if (related is null || related.IsDeleted)
        {
            throw new CommandValidationException("Related work item does not exist.");
        }

        var byWord = await session.LoadAsync<RelationshipTypeByWord>(command.Word);
        if (byWord is null || !byWord.IsActive)
        {
            throw new CommandValidationException($"Unknown relationship word '{command.Word}'.");
        }

        if (
            workItem.HasEdge(byWord.RelationshipTypeId, byWord.Direction, command.RelatedWorkItemId)
        )
        {
            throw new CommandValidationException("Relationship already exists.");
        }
    }

    [AggregateHandler]
    public static async Task<MartenEvents> Handle(
        Command command,
        WorkItem workItem,
        IDocumentSession session
    )
    {
        var byWord = (await session.LoadAsync<RelationshipTypeByWord>(command.Word))!;
        var type = (
            await session.LoadAsync<RelationshipTypeView.Model>(byWord.RelationshipTypeId)
        )!;
        var inverseDirection = Flip(byWord.Direction);
        var thisWord =
            byWord.Direction == RelationshipDirection.Forward ? type.ForwardWord : type.InverseWord;
        var inverseWord =
            byWord.Direction == RelationshipDirection.Forward ? type.InverseWord : type.ForwardWord;

        var related = await session.Events.FetchForWriting<WorkItem>(command.RelatedWorkItemId);
        if (
            !related.Aggregate!.HasEdge(
                byWord.RelationshipTypeId,
                inverseDirection,
                command.WorkItemId
            )
        )
        {
            related.AppendOne(
                new RelationshipAdded
                {
                    RelationshipTypeId = byWord.RelationshipTypeId,
                    Word = inverseWord,
                    Direction = inverseDirection,
                    RelatedWorkItemId = command.WorkItemId,
                }
            );
        }

        return
        [
            new RelationshipAdded
            {
                RelationshipTypeId = byWord.RelationshipTypeId,
                Word = thisWord,
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
