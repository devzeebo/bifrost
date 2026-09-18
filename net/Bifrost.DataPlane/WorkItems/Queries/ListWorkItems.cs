using Bifrost.WorkItems.Projections;
using Marten;

namespace Bifrost.WorkItems.Queries;

public static class ListWorkItemsHandler
{
    public static async Task<ListWorkItemsApi.Response> Handle(
        ListWorkItemsApi.Query query,
        IQuerySession session
    )
    {
        var items = session.Query<WorkItemIndex.Model>().Where(x => !x.IsDeleted);

        if (query.Status is not null)
        {
            WorkItemStatus status = query.Status;
            items = items.Where(x => x.Status == status.Value);
        }

        var list = await items.ToListAsync();
        return new ListWorkItemsApi.Response
        {
            Items =
            [
                .. list.Select(x => new ListWorkItemsApi.Response.Item
                {
                    Id = x.Id,
                    Status = x.Status,
                    IsDeleted = x.IsDeleted,
                }),
            ],
        };
    }
}
