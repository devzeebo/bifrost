using Bifrost.Capabilities.Evals;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class GetEvalSuiteRunHandler
{
    [WolverineQuery("/get-eval-suite-run/{id}")]
    public static Task<GetEvalSuiteRunApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new GetEvalSuiteRunApi.Query { Id = id }, session);

    public static async Task<GetEvalSuiteRunApi.Response> Handle(
        GetEvalSuiteRunApi.Query query,
        IQuerySession session
    )
    {
        var suite = await session.LoadAsync<EvalSuiteRunDocument>(query.Id);
        if (suite is null)
        {
            throw new CommandValidationException($"Suite run {query.Id} not found.");
        }

        var cases = new List<EvalCaseRunSummary>();
        foreach (var caseRunId in suite.CaseRunIds)
        {
            var run = await session.LoadAsync<EvalCaseRunDocument>(caseRunId);
            if (run is not null)
            {
                cases.Add(EvalRunMapper.ToSummary(run));
            }
        }

        return new GetEvalSuiteRunApi.Response
        {
            SuiteRunId = suite.Id,
            CapabilityId = suite.CapabilityId,
            SkillVersionId = suite.SkillVersionId,
            Status = suite.Status,
            CancelRequested = suite.CancelRequested,
            Summary = suite.Summary,
            Cases = cases,
            StartedAt = suite.StartedAt,
            CompletedAt = suite.CompletedAt,
        };
    }
}
