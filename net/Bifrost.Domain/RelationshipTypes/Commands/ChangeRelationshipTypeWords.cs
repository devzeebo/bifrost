using Bifrost.Domain.RelationshipTypes.Aggregate;
using Bifrost.Domain.RelationshipTypes.Events;
using Bifrost.Domain.RelationshipTypes.Projections;
using Bifrost.Domain.RelationshipTypes.Services;
using Bifrost.Domain.WorkItems.Projections;
using Marten;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Domain.RelationshipTypes.Commands;

public static class ChangeRelationshipTypeWordsHandler
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required RelationshipTypeWord ForwardWord { get; init; }
        public required RelationshipTypeWord InverseWord { get; init; }
    }

    public static async Task Validate(Command command, RelationshipType type, IQuerySession session)
    {
        if (!type.IsActive)
        {
            throw new CommandValidationException("Relationship type is retired.");
        }

        if (command.ForwardWord.IsEmpty || command.InverseWord.IsEmpty)
        {
            throw new CommandValidationException("ForwardWord and InverseWord are required.");
        }

        if (
            await WordTakenByOtherAsync(session, command.ForwardWord, type.Id)
            || (
                command.InverseWord != command.ForwardWord
                && await WordTakenByOtherAsync(session, command.InverseWord, type.Id)
            )
        )
        {
            throw new CommandValidationException(
                "One or both relationship words are already in use."
            );
        }
    }

    [AggregateHandler]
    public static async Task<MartenEvents> Handle(
        Command command,
        RelationshipType type,
        IDocumentSession session
    )
    {
        RelationshipTypeWord forward = command.ForwardWord;
        RelationshipTypeWord inverse = command.InverseWord;

        ReleaseRelationshipTypeWordsHandler.Handle(
            new ReleaseRelationshipTypeWordsHandler.Message
            {
                Forward = type.ForwardWord,
                Inverse = type.InverseWord,
            },
            session
        );
        ClaimRelationshipTypeWordsHandler.Handle(
            new ClaimRelationshipTypeWordsHandler.Message
            {
                RelationshipTypeId = type.Id,
                Forward = forward,
                Inverse = inverse,
            },
            session
        );

        await RefreshWorkItemViewWordsAsync(session, type.Id, forward, inverse);

        return
        [
            new RelationshipTypeWordsChanged
            {
                RelationshipTypeId = type.Id,
                PreviousForwardWord = type.ForwardWord,
                PreviousInverseWord = type.InverseWord,
                ForwardWord = forward,
                InverseWord = inverse,
            },
        ];
    }

    static async Task RefreshWorkItemViewWordsAsync(
        IDocumentSession session,
        Guid relationshipTypeId,
        RelationshipTypeWord forwardWord,
        RelationshipTypeWord inverseWord
    )
    {
        var items = await session
            .Query<WorkItemView.Model>()
            .Where(x => x.Relationships.Any(r => r.RelationshipTypeId == relationshipTypeId))
            .ToListAsync();

        foreach (var item in items)
        {
            session.Store(
                item with
                {
                    Relationships =
                    [
                        .. item.Relationships.Select(edge =>
                            edge.RelationshipTypeId != relationshipTypeId
                                ? edge
                                : edge with
                                {
                                    Word =
                                        edge.Direction == RelationshipDirection.Forward
                                            ? forwardWord
                                            : inverseWord,
                                }
                        ),
                    ],
                }
            );
        }
    }

    static async Task<bool> WordTakenByOtherAsync(
        IQuerySession session,
        RelationshipTypeWord word,
        Guid typeId
    )
    {
        var existing = await session.LoadAsync<RelationshipTypeByWord>(word);
        return existing is { IsActive: true } && existing.RelationshipTypeId != typeId;
    }
}
