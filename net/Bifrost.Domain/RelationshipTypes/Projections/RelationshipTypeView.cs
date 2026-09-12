using Bifrost.Domain.RelationshipTypes.Events;
using Marten.Events.Aggregation;

namespace Bifrost.Domain.RelationshipTypes.Projections;

public class RelationshipTypeView : SingleStreamProjection<RelationshipTypeView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required RelationshipTypeWord ForwardWord { get; init; }
        public required RelationshipTypeWord InverseWord { get; init; }
        public bool IsActive { get; init; }
    }

    public Model Create(RelationshipTypeDefined e) =>
        new()
        {
            Id = e.Id,
            ForwardWord = e.ForwardWord,
            InverseWord = e.InverseWord,
            IsActive = true,
        };

    public Model Apply(RelationshipTypeWordsChanged e, Model view) =>
        view with
        {
            ForwardWord = e.ForwardWord,
            InverseWord = e.InverseWord,
        };

    public Model Apply(RelationshipTypeRetired _, Model view) => view with { IsActive = false };
}
