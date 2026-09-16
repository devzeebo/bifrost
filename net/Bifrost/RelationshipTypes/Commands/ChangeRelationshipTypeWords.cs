using Bifrost.RelationshipTypes.Aggregate;
using Bifrost.RelationshipTypes.Events;
using Bifrost.RelationshipTypes.Projections;
using Marten;
using Wolverine.Http;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.RelationshipTypes.Commands;

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
            await WordTakenByOther(session, command.ForwardWord, type.Id)
            || (
                command.InverseWord != command.ForwardWord
                && await WordTakenByOther(session, command.InverseWord, type.Id)
            )
        )
        {
            throw new CommandValidationException(
                "One or both relationship words are already in use."
            );
        }
    }

    [WolverinePost("/change-relationship-type-words"), EmptyResponse]
    [AggregateHandler]
    public static MartenEvents Handle(Command command, RelationshipType type) =>
        [
            new RelationshipTypeWordsChanged
            {
                RelationshipTypeId = type.Id,
                PreviousForwardWord = type.ForwardWord,
                PreviousInverseWord = type.InverseWord,
                ForwardWord = command.ForwardWord,
                InverseWord = command.InverseWord,
            },
        ];

    static async Task<bool> WordTakenByOther(
        IQuerySession session,
        RelationshipTypeWord word,
        Guid typeId
    )
    {
        var existing = await session.LoadAsync<RelationshipTypeByWord.Model>(word.Value);
        return existing is { IsActive: true } && existing.RelationshipTypeId != typeId;
    }
}
