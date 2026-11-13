using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Projections;
using Marten;

namespace Bifrost.TrackedWorkItems.Queries;

public static class ListTrackedWorkItemsHeldByWorkerHandler
{
    [WolverineQuery("/list-tracked-work-items-held-by/{workerId}")]
    public static Task<ListTrackedWorkItemsHeldByWorkerApi.Response> Get(
        Guid workerId,
        IQuerySession session
    ) =>
        Handle(
            new ListTrackedWorkItemsHeldByWorkerApi.Query { WorkerId = workerId },
            session
        );

    public static async Task<ListTrackedWorkItemsHeldByWorkerApi.Response> Handle(
        ListTrackedWorkItemsHeldByWorkerApi.Query query,
        IQuerySession session
    )
    {
        var items = await session
            .Query<TrackedWorkItemView.Model>()
            .Where(i =>
                i.HolderId == query.WorkerId
                && (
                    i.Status == TrackedWorkItemStatuses.Claimed
                    || i.Status == TrackedWorkItemStatuses.Running
                    || i.Status == TrackedWorkItemStatuses.NeedsAttention
                )
            )
            .ToListAsync();

        return new ListTrackedWorkItemsHeldByWorkerApi.Response
        {
            Items = items
                .Select(i => new ListTrackedWorkItemsHeldByWorkerApi.Item
                {
                    Id = i.Id,
                    Status = i.Status,
                    HolderId = i.HolderId!.Value,
                })
                .ToList(),
        };
    }
}
