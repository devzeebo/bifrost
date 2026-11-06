using Bifrost.Capabilities.Evals;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class ProcessEvalSuiteHandler
{
    public static async Task<object[]> Handle(
        ProcessEvalSuite message,
        IDocumentSession session,
        EvalRunExecutor executor,
        EvalRunCancellation cancellation,
        CancellationToken ct
    )
    {
        var suite = await session.LoadAsync<EvalSuiteRunDocument>(message.SuiteRunId);
        if (suite is null)
        {
            return [];
        }

        if (suite.CompletedAt is not null)
        {
            return [];
        }

        var capability = await session.LoadAsync<CapabilityView.Model>(suite.CapabilityId);
        if (capability is null)
        {
            suite.Status = EvalSuiteRunStatuses.Canceled;
            suite.CompletedAt = DateTimeOffset.UtcNow;
            session.Store(suite);
            cancellation.Complete(suite.Id);
            return [];
        }

        var (markdown, skillVersionId) = await executor.ResolveSkill(
            session,
            capability,
            suite.SkillVersionId
        );

        var finishedEvalIds = new HashSet<Guid>();
        foreach (var caseRunId in suite.CaseRunIds)
        {
            var existing = await session.LoadAsync<EvalCaseRunDocument>(caseRunId);
            if (existing is not null)
            {
                finishedEvalIds.Add(existing.EvalId);
            }
        }

        var nextEvalId = suite.EvalIds.FirstOrDefault(id => !finishedEvalIds.Contains(id));
        if (nextEvalId == Guid.Empty)
        {
            await CompleteSuite(session, suite);
            cancellation.Complete(suite.Id);
            return [];
        }

        if (suite.CancelRequested)
        {
            await MarkRemainingNeverCompleted(
                session,
                capability,
                suite,
                finishedEvalIds,
                skillVersionId,
                markdown
            );
            await CompleteSuite(session, suite);
            cancellation.Complete(suite.Id);
            return [];
        }

        using var linked = CancellationTokenSource.CreateLinkedTokenSource(
            ct,
            cancellation.GetToken(suite.Id)
        );

        var eval = capability.Evals.First(e => e.Id == nextEvalId);
        try
        {
            var run = await executor.ExecuteCase(
                session,
                capability,
                eval,
                markdown,
                skillVersionId,
                suite.Id,
                linked.Token
            );
            suite.CaseRunIds.Add(run.Id);
            session.Store(suite);
            await session.SaveChangesAsync(CancellationToken.None);
        }
        catch (OperationCanceledException)
        {
            suite.CancelRequested = true;
            var incomplete = await session
                .Query<EvalCaseRunDocument>()
                .Where(r => r.SuiteRunId == suite.Id && r.EvalId == nextEvalId)
                .OrderByDescending(r => r.StartedAt)
                .FirstOrDefaultAsync(CancellationToken.None);
            if (incomplete is not null && !suite.CaseRunIds.Contains(incomplete.Id))
            {
                suite.CaseRunIds.Add(incomplete.Id);
            }

            finishedEvalIds.Add(nextEvalId);
            await MarkRemainingNeverCompleted(
                session,
                capability,
                suite,
                finishedEvalIds,
                skillVersionId,
                markdown
            );
            await CompleteSuite(session, suite);
            cancellation.Complete(suite.Id);
            return [];
        }

        finishedEvalIds.Add(nextEvalId);
        if (suite.CancelRequested)
        {
            await MarkRemainingNeverCompleted(
                session,
                capability,
                suite,
                finishedEvalIds,
                skillVersionId,
                markdown
            );
            await CompleteSuite(session, suite);
            cancellation.Complete(suite.Id);
            return [];
        }

        if (suite.EvalIds.All(finishedEvalIds.Contains))
        {
            await CompleteSuite(session, suite);
            cancellation.Complete(suite.Id);
            return [];
        }

        return [new ProcessEvalSuite { SuiteRunId = suite.Id }];
    }

    static async Task MarkRemainingNeverCompleted(
        IDocumentSession session,
        CapabilityView.Model capability,
        EvalSuiteRunDocument suite,
        HashSet<Guid> finishedEvalIds,
        Guid? skillVersionId,
        string markdown
    )
    {
        foreach (var evalId in suite.EvalIds.Where(id => !finishedEvalIds.Contains(id)))
        {
            var eval = capability.Evals.First(e => e.Id == evalId);
            var run = new EvalCaseRunDocument
            {
                Id = Guid.NewGuid(),
                CapabilityId = capability.Id,
                EvalId = eval.Id,
                CriterionId = eval.CriterionId,
                SuiteRunId = suite.Id,
                SkillVersionId = skillVersionId,
                CapabilityVersionId = capability.CurrentCapabilityVersionId,
                SkillMarkdown = markdown,
                IsEval = true,
                Status = EvalCaseRunStatuses.NeverCompleted,
                Outcome = null,
                StartedAt = DateTimeOffset.UtcNow,
                CompletedAt = DateTimeOffset.UtcNow,
            };
            session.Store(run);
            EvalRunExecutor.StoreLatest(session, run);
            suite.CaseRunIds.Add(run.Id);
            finishedEvalIds.Add(evalId);
        }

        session.Store(suite);
        await session.SaveChangesAsync(CancellationToken.None);
    }

    static async Task CompleteSuite(IDocumentSession session, EvalSuiteRunDocument suite)
    {
        var cases = new List<EvalCaseRunDocument>();
        foreach (var caseRunId in suite.CaseRunIds)
        {
            var run = await session.LoadAsync<EvalCaseRunDocument>(caseRunId);
            if (run is not null)
            {
                cases.Add(run);
            }
        }

        suite.Summary = EvalOutcomeRollup.FromCaseRuns(cases);
        suite.CompletedAt = DateTimeOffset.UtcNow;
        suite.Status = suite.CancelRequested
            || cases.Any(c => c.Status == EvalCaseRunStatuses.NeverCompleted)
            ? EvalSuiteRunStatuses.Canceled
            : EvalSuiteRunStatuses.Completed;
        session.Store(suite);
        await session.SaveChangesAsync(CancellationToken.None);
    }
}
