using Bifrost.Capabilities.Evals;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Editor;

/// <summary>
/// Newest completed suite run for a capability, or none — the derivation compose basis.
/// </summary>
public sealed record DerivationSuiteBasis
{
    public Guid? SuiteRunId { get; init; }
    public IReadOnlyList<EvalCaseRunDocument> CaseRuns { get; init; } = [];
    public IReadOnlyList<Guid> FailedEvalIds { get; init; } = [];
    public IReadOnlyList<Guid> PassedEvalIds { get; init; } = [];
    public IReadOnlyList<UnsettledCase> Unsettled { get; init; } = [];
    public IReadOnlyList<Guid> MovedEvalIds { get; init; } = [];
    public IReadOnlyList<Guid> MovedCriterionIds { get; init; } = [];

    public sealed record UnsettledCase(
        Guid EvalId,
        Guid CriterionId,
        string Status,
        string? Situation
    );

    public static async Task<DerivationSuiteBasis> Load(
        IQuerySession session,
        Guid capabilityId,
        CapabilityVersionSnapshot current
    )
    {
        var suite = await session
            .Query<EvalSuiteRunDocument>()
            .Where(s =>
                s.CapabilityId == capabilityId && s.Status == EvalSuiteRunStatuses.Completed
            )
            .OrderByDescending(s => s.CompletedAt)
            .FirstOrDefaultAsync();

        return suite is null
            ? new DerivationSuiteBasis()
            : await FromSuite(session, suite, current);
    }

    public static async Task<DerivationSuiteBasis> LoadNamed(
        IQuerySession session,
        Guid suiteRunId,
        CapabilityVersionSnapshot current
    )
    {
        var suite = await session.LoadAsync<EvalSuiteRunDocument>(suiteRunId);
        return suite is null || suite.Status != EvalSuiteRunStatuses.Completed
            ? new DerivationSuiteBasis()
            : await FromSuite(session, suite, current);
    }

    static async Task<DerivationSuiteBasis> FromSuite(
        IQuerySession session,
        EvalSuiteRunDocument suite,
        CapabilityVersionSnapshot current
    )
    {
        var caseRuns = await session
            .Query<EvalCaseRunDocument>()
            .Where(r => r.SuiteRunId == suite.Id)
            .ToListAsync();

        var failed = new List<Guid>();
        var passed = new List<Guid>();
        var unsettled = new List<UnsettledCase>();

        foreach (var run in caseRuns)
        {
            var status = EvalOutcomeRollup.LatestStatus(run);
            switch (status)
            {
                case EvalOutcomeStatuses.Failed:
                    failed.Add(run.EvalId);
                    break;
                case EvalOutcomeStatuses.Passed:
                    passed.Add(run.EvalId);
                    break;
                default:
                    unsettled.Add(
                        new UnsettledCase(
                            run.EvalId,
                            run.CriterionId,
                            status,
                            run.FailureReason
                        )
                    );
                    break;
            }
        }

        var (movedEvals, movedCriteria) = await MovedSinceRun(session, caseRuns, current);

        return new DerivationSuiteBasis
        {
            SuiteRunId = suite.Id,
            CaseRuns = caseRuns,
            FailedEvalIds = failed,
            PassedEvalIds = passed,
            Unsettled = unsettled,
            MovedEvalIds = movedEvals,
            MovedCriterionIds = movedCriteria,
        };
    }

    static async Task<(IReadOnlyList<Guid> Evals, IReadOnlyList<Guid> Criteria)> MovedSinceRun(
        IQuerySession session,
        IReadOnlyList<EvalCaseRunDocument> caseRuns,
        CapabilityVersionSnapshot current
    )
    {
        var versionId = caseRuns
            .Select(r => r.CapabilityVersionId)
            .FirstOrDefault(id => id is not null);
        if (versionId is null)
        {
            return ([], []);
        }

        var prior = await session.LoadAsync<CapabilityVersionView.Model>(versionId.Value);
        if (prior is null)
        {
            return (
                [.. current.Evals.Select(e => e.Id)],
                [.. current.Criteria.Select(c => c.Id)]
            );
        }

        var movedEvals = new List<Guid>();
        var movedCriteria = new List<Guid>();
        var priorEvals = prior.Snapshot.Evals.ToDictionary(e => e.Id);
        var priorCriteria = prior.Snapshot.Criteria.ToDictionary(c => c.Id);

        foreach (var eval in current.Evals)
        {
            if (
                !priorEvals.TryGetValue(eval.Id, out var old)
                || old.Scenario != eval.Scenario
                || old.Prompt != eval.Prompt
                || old.Context != eval.Context
                || old.Checks.Count != eval.Checks.Count
            )
            {
                movedEvals.Add(eval.Id);
                continue;
            }

            for (var i = 0; i < eval.Checks.Count; i++)
            {
                if (
                    old.Checks[i].Id != eval.Checks[i].Id
                    || old.Checks[i].Statement != eval.Checks[i].Statement
                    || old.Checks[i].Kind != eval.Checks[i].Kind
                    || old.Checks[i].Script != eval.Checks[i].Script
                )
                {
                    movedEvals.Add(eval.Id);
                    break;
                }
            }
        }

        foreach (var criterion in current.Criteria)
        {
            if (
                !priorCriteria.TryGetValue(criterion.Id, out var old)
                || old.Statement != criterion.Statement
            )
            {
                movedCriteria.Add(criterion.Id);
            }
        }

        return (movedEvals, movedCriteria);
    }
}
