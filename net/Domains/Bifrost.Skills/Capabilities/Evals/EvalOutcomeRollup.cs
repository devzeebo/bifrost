using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Evals;

public static class EvalOutcomeRollup
{
    public static string DeriveCaseOutcome(IReadOnlyList<EvalCheckVerdict> checks)
    {
        if (checks.Count == 0)
        {
            return EvalOutcomeStatuses.Unsettled;
        }

        if (checks.Any(c => c.Status == EvalCheckVerdictStatuses.Failed))
        {
            return EvalOutcomeStatuses.Failed;
        }

        if (checks.Any(c => c.Status == EvalCheckVerdictStatuses.Unsettled))
        {
            return EvalOutcomeStatuses.Unsettled;
        }

        if (checks.All(c => c.Status == EvalCheckVerdictStatuses.Passed))
        {
            return EvalOutcomeStatuses.Passed;
        }

        return EvalOutcomeStatuses.Unsettled;
    }

    public static string LatestStatus(EvalCaseRunDocument run) =>
        run.Status == EvalCaseRunStatuses.NeverCompleted
            ? EvalOutcomeStatuses.NeverCompleted
            : run.Outcome ?? EvalOutcomeStatuses.Unsettled;

    public static SuiteEvalSummary Summarize(IEnumerable<EvalLatestOutcome> outcomes)
    {
        var summary = new SuiteEvalSummary();
        foreach (var outcome in outcomes)
        {
            switch (outcome.Status)
            {
                case EvalOutcomeStatuses.Passed:
                    summary = summary with { Passed = summary.Passed + 1 };
                    break;
                case EvalOutcomeStatuses.Failed:
                    summary = summary with { Failed = summary.Failed + 1 };
                    break;
                case EvalOutcomeStatuses.Unsettled:
                    summary = summary with { Unsettled = summary.Unsettled + 1 };
                    break;
                case EvalOutcomeStatuses.NeverCompleted:
                    summary = summary with { NeverCompleted = summary.NeverCompleted + 1 };
                    break;
                default:
                    summary = summary with { NeverRun = summary.NeverRun + 1 };
                    break;
            }
        }

        return summary;
    }

    public static CriterionEvalRollup CriterionRollup(
        Guid criterionId,
        IEnumerable<EvalLatestOutcome> outcomes
    )
    {
        var list = outcomes.Where(o => o.CriterionId == criterionId).ToList();
        var summary = Summarize(list);
        return new CriterionEvalRollup
        {
            CriterionId = criterionId,
            Passed = summary.Passed,
            Failed = summary.Failed,
            Unsettled = summary.Unsettled,
            NeverCompleted = summary.NeverCompleted,
            NeverRun = summary.NeverRun,
        };
    }

    public static SuiteEvalSummary FromCaseRuns(IEnumerable<EvalCaseRunDocument> runs)
    {
        var summary = new SuiteEvalSummary();
        foreach (var run in runs)
        {
            var status = LatestStatus(run);
            switch (status)
            {
                case EvalOutcomeStatuses.Passed:
                    summary = summary with { Passed = summary.Passed + 1 };
                    break;
                case EvalOutcomeStatuses.Failed:
                    summary = summary with { Failed = summary.Failed + 1 };
                    break;
                case EvalOutcomeStatuses.Unsettled:
                    summary = summary with { Unsettled = summary.Unsettled + 1 };
                    break;
                case EvalOutcomeStatuses.NeverCompleted:
                    summary = summary with { NeverCompleted = summary.NeverCompleted + 1 };
                    break;
                default:
                    summary = summary with { NeverRun = summary.NeverRun + 1 };
                    break;
            }
        }

        return summary;
    }
}
