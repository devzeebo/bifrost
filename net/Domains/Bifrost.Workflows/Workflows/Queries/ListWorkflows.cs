using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Projections;
using Marten;

namespace Bifrost.Workflows.Queries;

public static class ListWorkflowsHandler
{
    [WolverineQuery("/list-workflows")]
    public static async Task<ListWorkflowsApi.Response> Handle(
        ListWorkflowsApi.Query query,
        IQuerySession session
    )
    {
        var items = await session.Query<WorkflowIndex.Model>().ToListAsync();
        return new ListWorkflowsApi.Response
        {
            Items =
            [
                .. items
                    .OrderBy(x => x.Name)
                    .Select(x => new ListWorkflowsApi.Response.Item { Id = x.Id, Name = x.Name }),
            ],
        };
    }
}
