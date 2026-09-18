using Bifrost.WorkItems.Projections;
using Marten;

namespace Bifrost.WorkItems.Queries;

public static class GetWorkItemHandler
{
    public static async Task<GetWorkItemApi.Response> Handle(
        GetWorkItemApi.Query query,
        IQuerySession session
    )
    {
        var item =
            await session.LoadAsync<WorkItemView.Model>(query.Id)
            ?? throw new CommandValidationException($"Work item {query.Id} not found.");

        return new GetWorkItemApi.Response
        {
            Id = item.Id,
            Data = item.Data,
            Status = item.Status,
            IsDeleted = item.IsDeleted,
            Relationships =
            [
                .. item.Relationships.Select(r => new GetWorkItemApi.Response.Relationship
                {
                    RelationshipTypeId = r.RelationshipTypeId,
                    Word = r.Word,
                    Direction = r.Direction,
                    RelatedWorkItemId = r.RelatedWorkItemId,
                }),
            ],
        };
    }
}
