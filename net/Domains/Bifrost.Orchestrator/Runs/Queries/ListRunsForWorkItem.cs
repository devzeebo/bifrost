using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Projections;
using Marten;

namespace Bifrost.Runs.Queries;

public static class ListRunsForWorkItemHandler
{
    [WolverineQuery("/list-runs-for-work-item")]
    public static async Task<ListRunsForWorkItemApi.Response> Handle(
        ListRunsForWorkItemApi.Query query,
        IQuerySession session
    )
    {
        var runs = await session
            .Query<RunView.Model>()
            .Where(x => x.WorkItemId == query.WorkItemId)
            .OrderBy(x => x.Position)
            .ToListAsync();

        return new ListRunsForWorkItemApi.Response
        {
            Items =
            [
                .. runs.Select(x => new ListRunsForWorkItemApi.Response.Item
                {
                    Id = x.Id,
                    WorkItemId = x.WorkItemId,
                    Position = x.Position,
                    CreatedAt = x.CreatedAt,
                    Outcome = x.Outcome,
                }),
            ],
        };
    }
}
