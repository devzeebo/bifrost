using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Projections;
using Marten;

namespace Bifrost.TrackedWorkItems.Queries;

public static class ListPendingTrackedWorkItemsHandler
{
    [WolverineQuery("/list-pending-tracked-work-items")]
    public static async Task<ListPendingTrackedWorkItemsApi.Response> Handle(
        ListPendingTrackedWorkItemsApi.Query _,
        IQuerySession session
    )
    {
        var items = await session
            .Query<TrackedWorkItemView.Model>()
            .Where(i => i.Status == TrackedWorkItemStatuses.Pending)
            .ToListAsync();

        return new ListPendingTrackedWorkItemsApi.Response
        {
            Items = items
                .Select(i => new ListPendingTrackedWorkItemsApi.Item
                {
                    Id = i.Id,
                    Status = i.Status,
                    HolderId = i.HolderId,
                })
                .ToList(),
        };
    }
}
