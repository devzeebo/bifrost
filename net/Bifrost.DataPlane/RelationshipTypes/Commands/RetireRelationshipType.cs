using Bifrost.RelationshipTypes.Aggregate;
using Bifrost.RelationshipTypes.Events;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.RelationshipTypes.Commands;

public static class RetireRelationshipTypeHandler
{
    public static void Validate(RetireRelationshipTypeApi.Command command, RelationshipType type)
    {
        if (!type.IsActive)
        {
            throw new CommandValidationException("Relationship type is already retired.");
        }
    }
    [AggregateHandler]
    public static MartenEvents Handle(RetireRelationshipTypeApi.Command command, RelationshipType type) =>
        [
            new RelationshipTypeRetired
            {
                RelationshipTypeId = type.Id,
                ForwardWord = type.ForwardWord,
                InverseWord = type.InverseWord,
            },
        ];
}
