using Bifrost.Capabilities.Evals;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class RunCapabilityEvalHandler
{
    public static async Task Validate(
        RunCapabilityEvalApi.Command command,
        IQuerySession session
    )
    {
        var capability = await session.LoadAsync<CapabilityView.Model>(command.Id);
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (capability.Evals.All(e => e.Id != command.EvalId))
        {
            throw new CommandValidationException($"Eval {command.EvalId} not found.");
        }
    }

    [WolverinePost("/run-capability-eval")]
    public static async Task<RunCapabilityEvalApi.Response> Handle(
        RunCapabilityEvalApi.Command command,
        IDocumentSession session,
        EvalRunExecutor executor,
        CancellationToken ct
    )
    {
        var capability = (await session.LoadAsync<CapabilityView.Model>(command.Id))!;
        var eval = capability.Evals.First(e => e.Id == command.EvalId);
        var (markdown, skillVersionId) = await executor.ResolveSkill(
            session,
            capability,
            command.SkillVersionId
        );

        try
        {
            var run = await executor.ExecuteCase(
                session,
                capability,
                eval,
                markdown,
                skillVersionId,
                suiteRunId: null,
                ct
            );
            return new RunCapabilityEvalApi.Response { Run = EvalRunMapper.ToSummary(run) };
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            var incomplete = await session.Query<EvalCaseRunDocument>()
                .Where(r => r.CapabilityId == command.Id && r.EvalId == command.EvalId)
                .OrderByDescending(r => r.StartedAt)
                .FirstOrDefaultAsync(CancellationToken.None);
            if (incomplete is null)
            {
                throw;
            }

            return new RunCapabilityEvalApi.Response
            {
                Run = EvalRunMapper.ToSummary(incomplete),
            };
        }
    }
}
