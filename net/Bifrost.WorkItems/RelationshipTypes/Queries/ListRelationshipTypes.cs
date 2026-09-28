using Bifrost.RelationshipTypes.Projections;
using Marten;

namespace Bifrost.RelationshipTypes.Queries;

public static class ListRelationshipTypesHandler
{
    [WolverineQuery("/list-relationship-types")]
    public static async Task<IReadOnlyList<ListRelationshipTypesApi.Response.Item>> Handle(
        ListRelationshipTypesApi.Query query,
        IQuerySession session
    )
    {
        var list = await session.Query<RelationshipTypeView.Model>().ToListAsync();
        return
        [
            .. list.Select(x => new ListRelationshipTypesApi.Response.Item
            {
                Id = x.Id,
                ForwardWord = x.ForwardWord,
                InverseWord = x.InverseWord,
                IsActive = x.IsActive,
            }),
        ];
    }
}
