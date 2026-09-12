using Bifrost.RelationshipTypes.Projections;
using Wolverine.Http;
using Wolverine.Http.Marten;

namespace Bifrost.RelationshipTypes.Queries;

public static class GetRelationshipTypeHandler
{
    [WolverineQuery("/get-relationship-type/{id}")]
    public static RelationshipTypeView.Model Handle([Document] RelationshipTypeView.Model item) =>
        item;
}
