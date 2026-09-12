using Bifrost.Domain.RelationshipTypes.Projections;
using Marten;

namespace Bifrost.Domain.RelationshipTypes.Services;

/// <summary>
/// Claims forward/inverse words on the word index (same Marten session as the aggregate events).
/// </summary>
public static class ClaimRelationshipTypeWordsHandler
{
    public sealed record Message
    {
        public required Guid RelationshipTypeId { get; init; }
        public required RelationshipTypeWord Forward { get; init; }
        public required RelationshipTypeWord Inverse { get; init; }
    }

    public static void Handle(Message message, IDocumentSession session)
    {
        session.Store(
            new RelationshipTypeByWord
            {
                Word = message.Forward,
                RelationshipTypeId = message.RelationshipTypeId,
                Direction = RelationshipDirection.Forward,
                IsActive = true,
            }
        );

        if (message.Inverse != message.Forward)
        {
            session.Store(
                new RelationshipTypeByWord
                {
                    Word = message.Inverse,
                    RelationshipTypeId = message.RelationshipTypeId,
                    Direction = RelationshipDirection.Inverse,
                    IsActive = true,
                }
            );
        }
    }
}
