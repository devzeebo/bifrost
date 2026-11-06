using Bifrost.Capabilities.Evals;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class ListEvalCaseRunsHandler
{
    [WolverineQuery("/list-eval-case-runs/{capabilityId}/{evalId}")]
    public static Task<ListEvalCaseRunsApi.Response> Get(
        Guid capabilityId,
        Guid evalId,
        IQuerySession session
    ) =>
        Handle(
            new ListEvalCaseRunsApi.Query { CapabilityId = capabilityId, EvalId = evalId },
            session
        );

    public static async Task<ListEvalCaseRunsApi.Response> Handle(
        ListEvalCaseRunsApi.Query query,
        IQuerySession session
    )
    {
        var items = await session
            .Query<EvalCaseRunDocument>()
            .Where(r => r.CapabilityId == query.CapabilityId && r.EvalId == query.EvalId)
            .OrderByDescending(r => r.StartedAt)
            .ToListAsync();

        return new ListEvalCaseRunsApi.Response
        {
            Items = items.Select(EvalRunMapper.ToSummary).ToList(),
        };
    }
}
