using Bifrost.RelationshipTypes.Projections;
using Marten;

namespace Bifrost.RelationshipTypes.Queries;

public static class GetRelationshipTypeHandler
{
    public static async Task<GetRelationshipTypeApi.Response> Handle(
        GetRelationshipTypeApi.Query query,
        IQuerySession session
    )
    {
        var item =
            await session.LoadAsync<RelationshipTypeView.Model>(query.Id)
            ?? throw new CommandValidationException($"Relationship type {query.Id} not found.");

        return new GetRelationshipTypeApi.Response
        {
            Id = item.Id,
            ForwardWord = item.ForwardWord,
            InverseWord = item.InverseWord,
            IsActive = item.IsActive,
        };
    }
}
