using Bifrost.RelationshipTypes.Events;

namespace Bifrost.RelationshipTypes.Aggregate;

public class RelationshipType
{
    public Guid Id { get; set; }
    public required RelationshipTypeWord ForwardWord { get; set; }
    public required RelationshipTypeWord InverseWord { get; set; }
    public bool IsActive { get; set; }

    public void Apply(RelationshipTypeDefined e)
    {
        Id = e.Id;
        ForwardWord = e.ForwardWord;
        InverseWord = e.InverseWord;
        IsActive = true;
    }

    public void Apply(RelationshipTypeWordsChanged e)
    {
        ForwardWord = e.ForwardWord;
        InverseWord = e.InverseWord;
    }

    public void Apply(RelationshipTypeRetired _)
    {
        IsActive = false;
    }
}
