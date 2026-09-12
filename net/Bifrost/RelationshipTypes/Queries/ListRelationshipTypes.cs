using Bifrost.RelationshipTypes.Projections;
using Marten;
using Wolverine.Http;

namespace Bifrost.RelationshipTypes.Queries;

public static class ListRelationshipTypesHandler
{
    public sealed record Query;

    [WolverineQuery("/list-relationship-types")]
    public static Task<IReadOnlyList<RelationshipTypeView.Model>> Handle(
        Query _,
        IQuerySession session
    ) => session.Query<RelationshipTypeView.Model>().ToListAsync();
}
