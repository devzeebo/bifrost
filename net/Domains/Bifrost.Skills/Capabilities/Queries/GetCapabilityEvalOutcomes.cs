using Bifrost.Capabilities.Evals;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class GetCapabilityEvalOutcomesHandler
{
    [WolverineQuery("/get-capability-eval-outcomes/{id}")]
    public static Task<GetCapabilityEvalOutcomesApi.Response> Get(
        Guid id,
        IQuerySession session
    ) => Handle(new GetCapabilityEvalOutcomesApi.Query { Id = id }, session);

    public static async Task<GetCapabilityEvalOutcomesApi.Response> Handle(
        GetCapabilityEvalOutcomesApi.Query query,
        IQuerySession session
    )
    {
        var capability = await session.LoadAsync<CapabilityView.Model>(query.Id);
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {query.Id} not found.");
        }

        var latestDocs = await session
            .Query<EvalLatestByEvalDocument>()
            .Where(d => d.CapabilityId == query.Id)
            .ToListAsync();
        var latestByEval = latestDocs.ToDictionary(d => d.EvalId);

        var evalOutcomes = capability
            .Evals.Select(eval =>
            {
                if (!latestByEval.TryGetValue(eval.Id, out var latest))
                {
                    return new EvalLatestOutcome
                    {
                        EvalId = eval.Id,
                        CriterionId = eval.CriterionId,
                        Status = EvalOutcomeStatuses.NeverRun,
                        CaseRunId = null,
                        CapabilityVersionId = null,
                        SkillVersionId = null,
                    };
                }

                return new EvalLatestOutcome
                {
                    EvalId = eval.Id,
                    CriterionId = eval.CriterionId,
                    Status = latest.Status,
                    CaseRunId = latest.CaseRunId,
                    CapabilityVersionId = latest.CapabilityVersionId,
                    SkillVersionId = latest.SkillVersionId,
                };
            })
            .ToList();

        var criteria = capability
            .Criteria.Select(c => EvalOutcomeRollup.CriterionRollup(c.Id, evalOutcomes))
            .ToList();

        return new GetCapabilityEvalOutcomesApi.Response
        {
            CapabilityId = capability.Id,
            Suite = EvalOutcomeRollup.Summarize(evalOutcomes),
            Criteria = criteria,
            Evals = evalOutcomes,
        };
    }
}
