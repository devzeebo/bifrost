using Bifrost.Domain.RelationshipTypes.Aggregate;
using Bifrost.Domain.RelationshipTypes.Events;
using Bifrost.Domain.RelationshipTypes.Projections;
using Marten;
using Wolverine.Marten;

namespace Bifrost.Domain.RelationshipTypes.Commands;

public static class DefineRelationshipTypeHandler
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required RelationshipTypeWord ForwardWord { get; init; }
        public required RelationshipTypeWord InverseWord { get; init; }
    }

    public static async Task Validate(Command command, IQuerySession session)
    {
        if (
            await WordTakenAsync(session, command.ForwardWord)
            || (
                command.InverseWord != command.ForwardWord
                && await WordTakenAsync(session, command.InverseWord)
            )
        )
        {
            throw new CommandValidationException(
                "One or both relationship words are already in use."
            );
        }

        if (await session.LoadAsync<RelationshipTypeView.Model>(command.Id) is not null)
        {
            throw new CommandValidationException($"Relationship type {command.Id} already exists.");
        }
    }

    public static IStartStream Handle(Command command, IDocumentSession session)
    {
        RelationshipTypeWordIndex.ClaimWords(
            session,
            command.Id,
            command.ForwardWord,
            command.InverseWord
        );

        return MartenOps.StartStream<RelationshipType>(
            command.Id,
            new RelationshipTypeDefined
            {
                Id = command.Id,
                ForwardWord = command.ForwardWord,
                InverseWord = command.InverseWord,
            }
        );
    }

    static async Task<bool> WordTakenAsync(IQuerySession session, RelationshipTypeWord word)
    {
        var existing = await session.LoadAsync<RelationshipTypeByWord>(word);
        return existing is { IsActive: true };
    }
}
