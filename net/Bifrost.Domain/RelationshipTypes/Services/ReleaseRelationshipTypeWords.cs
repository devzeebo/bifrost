using Bifrost.Domain.RelationshipTypes.Projections;
using Marten;

namespace Bifrost.Domain.RelationshipTypes.Services;

/// <summary>
/// Releases forward/inverse words from the word index (same Marten session as the aggregate events).
/// </summary>
public static class ReleaseRelationshipTypeWordsHandler
{
    public sealed record Message
    {
        public required RelationshipTypeWord Forward { get; init; }
        public required RelationshipTypeWord Inverse { get; init; }
    }

    public static void Handle(Message message, IDocumentSession session)
    {
        session.Store(new RelationshipTypeByWord { Word = message.Forward, IsActive = false });

        if (message.Inverse != message.Forward)
        {
            session.Store(new RelationshipTypeByWord { Word = message.Inverse, IsActive = false });
        }
    }
}
