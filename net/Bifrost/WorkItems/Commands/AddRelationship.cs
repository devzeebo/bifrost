using Bifrost.RelationshipTypes;
using Bifrost.RelationshipTypes.Projections;
using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Bifrost.WorkItems.Projections;
using Marten;
using Wolverine.Http;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.WorkItems.Commands;

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

        RelationshipTypeWord word = command.Word;
        var byWord = await session.LoadAsync<RelationshipTypeByWord.Model>(word.Value);
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

    [WolverinePost("/add-relationship"), EmptyResponse]
    [AggregateHandler]
    public static async Task<MartenEvents> Handle(
        Command command,
        WorkItem workItem,
        IDocumentSession session
    )
    {
        RelationshipTypeWord word = command.Word;
        var byWord = (await session.LoadAsync<RelationshipTypeByWord.Model>(word.Value))!;
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
