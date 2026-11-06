using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Evals;

public static class EvalRunMapper
{
    public static EvalCaseRunSummary ToSummary(EvalCaseRunDocument run) =>
        new()
        {
            Id = run.Id,
            CapabilityId = run.CapabilityId,
            EvalId = run.EvalId,
            CriterionId = run.CriterionId,
            SuiteRunId = run.SuiteRunId,
            SkillVersionId = run.SkillVersionId,
            CapabilityVersionId = run.CapabilityVersionId,
            IsEval = run.IsEval,
            Status = run.Status,
            Outcome = run.Outcome,
            Transcript = run.Transcript,
            Spend = run.Spend,
            Checks = run.Checks,
            StartedAt = run.StartedAt,
            CompletedAt = run.CompletedAt,
        };
}
