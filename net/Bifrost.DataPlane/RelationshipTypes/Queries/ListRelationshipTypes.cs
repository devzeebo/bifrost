using Bifrost.RelationshipTypes.Projections;
using Marten;

namespace Bifrost.RelationshipTypes.Queries;

public static class ListRelationshipTypesHandler
{
    public static async Task<ListRelationshipTypesApi.Response> Handle(
        ListRelationshipTypesApi.Query query,
        IQuerySession session
    )
    {
        var list = await session.Query<RelationshipTypeView.Model>().ToListAsync();
        return new ListRelationshipTypesApi.Response
        {
            Items =
            [
                .. list.Select(x => new ListRelationshipTypesApi.Response.Item
                {
                    Id = x.Id,
                    ForwardWord = x.ForwardWord,
                    InverseWord = x.InverseWord,
                    IsActive = x.IsActive,
                }),
            ],
        };
    }
}
