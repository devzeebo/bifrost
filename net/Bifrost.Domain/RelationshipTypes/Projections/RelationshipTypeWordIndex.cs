using Marten;

namespace Bifrost.Domain.RelationshipTypes.Projections;

/// <summary>
/// Word lookup documents maintained in-command (same Marten session as the aggregate events).
/// Answers: which relationship type + direction does this word resolve to?
/// </summary>
public static class RelationshipTypeWordIndex
{
    public static void ClaimWords(
        IDocumentSession session,
        Guid relationshipTypeId,
        RelationshipTypeWord forward,
        RelationshipTypeWord inverse
    )
    {
        session.Store(
            new RelationshipTypeByWord
            {
                Word = forward,
                RelationshipTypeId = relationshipTypeId,
                Direction = RelationshipDirection.Forward,
                IsActive = true,
            }
        );

        if (inverse != forward)
        {
            session.Store(
                new RelationshipTypeByWord
                {
                    Word = inverse,
                    RelationshipTypeId = relationshipTypeId,
                    Direction = RelationshipDirection.Inverse,
                    IsActive = true,
                }
            );
        }
    }

    public static void ReleaseWords(
        IDocumentSession session,
        RelationshipTypeWord forward,
        RelationshipTypeWord inverse
    )
    {
        session.Store(new RelationshipTypeByWord { Word = forward, IsActive = false });

        if (inverse != forward)
        {
            session.Store(new RelationshipTypeByWord { Word = inverse, IsActive = false });
        }
    }
}
