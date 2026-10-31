using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Projections;
using Marten;

namespace Bifrost.TrackedWorkItems.Queries;

public static class GetTrackedWorkItemHandler
{
    [WolverineQuery("/get-tracked-work-item/{id}")]
    public static Task<GetTrackedWorkItemApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new GetTrackedWorkItemApi.Query { Id = id }, session);

    public static async Task<GetTrackedWorkItemApi.Response> Handle(
        GetTrackedWorkItemApi.Query query,
        IQuerySession session
    )
    {
        var item =
            await session.LoadAsync<TrackedWorkItemView.Model>(query.Id)
            ?? throw new CommandValidationException($"Tracked work item {query.Id} not found.");

        return new GetTrackedWorkItemApi.Response { Id = item.Id, Status = item.Status };
    }
}
