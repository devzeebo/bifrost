using Bifrost.Capabilities.Evals;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class RunCapabilitySuiteHandler
{
    public static async Task Validate(
        RunCapabilitySuiteApi.Command command,
        IQuerySession session
    )
    {
        var capability = await session.LoadAsync<CapabilityView.Model>(command.Id);
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (capability.Evals.Count == 0)
        {
            throw new CommandValidationException("Capability has no evals to run.");
        }

        var activeSuite = await session
            .Query<EvalSuiteRunDocument>()
            .Where(s =>
                s.CapabilityId == command.Id && s.Status == EvalSuiteRunStatuses.Running
            )
            .AnyAsync();
        if (activeSuite)
        {
            throw new CommandValidationException(
                "A suite is already running for this capability. Cancel it or wait for it to finish."
            );
        }

        if (command.EvalIds is { Count: > 0 })
        {
            foreach (var evalId in command.EvalIds.Distinct())
            {
                if (capability.Evals.All(e => e.Id != evalId))
                {
                    throw new CommandValidationException($"Eval {evalId} not found.");
                }
            }
        }

        if (command.SkillVersionId is { } versionId)
        {
            var version = await session.LoadAsync<SkillVersionView.Model>(versionId);
            if (version is null || version.CapabilityId != capability.Id)
            {
                throw new CommandValidationException($"Skill version {versionId} not found.");
            }

            if (string.IsNullOrWhiteSpace(version.Snapshot.Markdown))
            {
                throw new CommandValidationException("Skill version markdown is empty.");
            }
        }
        else if (string.IsNullOrWhiteSpace(capability.SkillMarkdown))
        {
            throw new CommandValidationException(
                "Skill draft markdown is empty. Save a derived skill before running evals."
            );
        }
    }

    [WolverinePost("/run-capability-suite")]
    public static async Task<(
        RunCapabilitySuiteApi.Response Response,
        ProcessEvalSuite Next
    )> Handle(RunCapabilitySuiteApi.Command command, IDocumentSession session)
    {
        var capability = (await session.LoadAsync<CapabilityView.Model>(command.Id))!;
        var evalIds =
            command.EvalIds is { Count: > 0 }
                ? command.EvalIds.Distinct().ToList()
                : capability.Evals.Select(e => e.Id).ToList();

        var suite = new EvalSuiteRunDocument
        {
            Id = Guid.NewGuid(),
            CapabilityId = capability.Id,
            SkillVersionId = command.SkillVersionId,
            Status = EvalSuiteRunStatuses.Running,
            EvalIds = evalIds,
            StartedAt = DateTimeOffset.UtcNow,
        };
        session.Store(suite);

        return (
            new RunCapabilitySuiteApi.Response
            {
                SuiteRunId = suite.Id,
                Status = suite.Status,
                Summary = new SuiteEvalSummary { NeverRun = evalIds.Count },
                Cases = [],
            },
            new ProcessEvalSuite { SuiteRunId = suite.Id }
        );
    }
}
