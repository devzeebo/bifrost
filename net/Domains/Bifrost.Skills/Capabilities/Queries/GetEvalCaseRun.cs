using Bifrost.Capabilities.Evals;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class GetEvalCaseRunHandler
{
    [WolverineQuery("/get-eval-case-run/{id}")]
    public static Task<GetEvalCaseRunApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new GetEvalCaseRunApi.Query { Id = id }, session);

    public static async Task<GetEvalCaseRunApi.Response> Handle(
        GetEvalCaseRunApi.Query query,
        IQuerySession session
    )
    {
        var run = await session.LoadAsync<EvalCaseRunDocument>(query.Id);
        if (run is null)
        {
            throw new CommandValidationException($"Eval case run {query.Id} not found.");
        }

        return new GetEvalCaseRunApi.Response { Run = EvalRunMapper.ToSummary(run) };
    }
}
