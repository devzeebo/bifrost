using Bifrost.RelationshipTypes.Events;
using JasperFx.Events;
using Marten.Events.Projections;

namespace Bifrost.RelationshipTypes.Projections;

public class RelationshipTypeByWord : MultiStreamProjection<RelationshipTypeByWord.Model, string>
{
    public class Model
    {
        public string Id { get; set; } = "";
        public Guid RelationshipTypeId { get; set; }
        public RelationshipDirection Direction { get; set; }
        public bool IsActive { get; set; }
    }

    public RelationshipTypeByWord()
    {
        Name = nameof(RelationshipTypeByWord);

        Identities<RelationshipTypeDefined>(e => Words(e.ForwardWord, e.InverseWord));
        Identities<RelationshipTypeWordsChanged>(e =>
            Words(
                e.PreviousForwardWord,
                e.PreviousInverseWord,
                e.ForwardWord,
                e.InverseWord
            )
        );
        Identities<RelationshipTypeRetired>(e => Words(e.ForwardWord, e.InverseWord));
    }

    public override Model? Evolve(Model? snapshot, string id, IEvent e) =>
        e.Data switch
        {
            RelationshipTypeDefined defined => ApplyDefined(id, defined),
            RelationshipTypeWordsChanged changed => ApplyChanged(snapshot, id, changed),
            RelationshipTypeRetired retired => ApplyRetired(snapshot, id, retired),
            _ => snapshot,
        };

    static Model ApplyDefined(string id, RelationshipTypeDefined e) =>
        new()
        {
            Id = id,
            RelationshipTypeId = e.Id,
            Direction =
                id == e.ForwardWord.Value
                    ? RelationshipDirection.Forward
                    : RelationshipDirection.Inverse,
            IsActive = true,
        };

    static Model ApplyChanged(Model? snapshot, string id, RelationshipTypeWordsChanged e)
    {
        if (id == e.ForwardWord.Value)
        {
            return new Model
            {
                Id = id,
                RelationshipTypeId = e.RelationshipTypeId,
                Direction = RelationshipDirection.Forward,
                IsActive = true,
            };
        }

        if (id == e.InverseWord.Value)
        {
            return new Model
            {
                Id = id,
                RelationshipTypeId = e.RelationshipTypeId,
                Direction = RelationshipDirection.Inverse,
                IsActive = true,
            };
        }

        return new Model
        {
            Id = id,
            RelationshipTypeId = snapshot?.RelationshipTypeId ?? e.RelationshipTypeId,
            Direction = snapshot?.Direction ?? RelationshipDirection.Forward,
            IsActive = false,
        };
    }

    static Model ApplyRetired(Model? snapshot, string id, RelationshipTypeRetired e) =>
        new()
        {
            Id = id,
            RelationshipTypeId = snapshot?.RelationshipTypeId ?? e.RelationshipTypeId,
            Direction = snapshot?.Direction ?? RelationshipDirection.Forward,
            IsActive = false,
        };

    static IReadOnlyList<string> Words(params RelationshipTypeWord[] words) =>
        words.Where(w => !w.IsEmpty).Select(w => w.Value).Distinct().ToArray();
}
