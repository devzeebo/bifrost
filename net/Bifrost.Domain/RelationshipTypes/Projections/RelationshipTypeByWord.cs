using JasperFx;

namespace Bifrost.Domain.RelationshipTypes.Projections;

public class RelationshipTypeByWord
{
    [Identity]
    public required RelationshipTypeWord Word { get; set; }

    public Guid RelationshipTypeId { get; set; }
    public RelationshipDirection Direction { get; set; }
    public bool IsActive { get; set; }
}
