using Bifrost.RelationshipTypes.Aggregate;
using Bifrost.RelationshipTypes.Events;
using Bifrost.RelationshipTypes.Projections;
using Marten;
using Wolverine.Http;
using Wolverine.Marten;

namespace Bifrost.RelationshipTypes.Commands;

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
            await WordTaken(session, command.ForwardWord)
            || (
                command.InverseWord != command.ForwardWord
                && await WordTaken(session, command.InverseWord)
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

    [WolverinePost("/define-relationship-type"), EmptyResponse]
    public static IStartStream Handle(Command command) =>
        MartenOps.StartStream<RelationshipType>(
            command.Id,
            new RelationshipTypeDefined
            {
                Id = command.Id,
                ForwardWord = command.ForwardWord,
                InverseWord = command.InverseWord,
            }
        );

    static async Task<bool> WordTaken(IQuerySession session, RelationshipTypeWord word)
    {
        var existing = await session.LoadAsync<RelationshipTypeByWord.Model>(word.Value);
        return existing is { IsActive: true };
    }
}
