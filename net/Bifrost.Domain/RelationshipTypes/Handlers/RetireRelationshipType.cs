using Bifrost.Domain.RelationshipTypes.Aggregate;
using Bifrost.Domain.RelationshipTypes.Events;
using Bifrost.Domain.RelationshipTypes.Projections;
using Marten;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Domain.RelationshipTypes.Commands;

public static class RetireRelationshipTypeHandler
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }

    public static void Validate(Command command, RelationshipType type)
    {
        if (!type.IsActive)
        {
            throw new CommandValidationException("Relationship type is already retired.");
        }
    }

    [AggregateHandler]
    public static MartenEvents Handle(
        Command command,
        RelationshipType type,
        IDocumentSession session
    )
    {
        RelationshipTypeWordIndex.ReleaseWords(session, type.ForwardWord, type.InverseWord);

        return
        [
            new RelationshipTypeRetired
            {
                RelationshipTypeId = type.Id,
                ForwardWord = type.ForwardWord,
                InverseWord = type.InverseWord,
            },
        ];
    }
}
