using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Editor;
using Bifrost.Capabilities.Events;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Capabilities.Commands;

public static class AmendCapabilityEvalHandler
{
    public static void Validate(AmendCapabilityEvalApi.Command command, Capability? capability)
    {
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (capability.Evals.All(e => e.Id != command.EvalId))
        {
            throw new CommandValidationException($"Eval {command.EvalId} not found.");
        }

        if (string.IsNullOrWhiteSpace(command.Scenario))
        {
            throw new CommandValidationException("Scenario is required.");
        }

        if (command.Checks is { Count: 0 })
        {
            throw new CommandValidationException("At least one check is required.");
        }

        if (command.Checks is null)
        {
            return;
        }

        var seen = new HashSet<Guid>();
        foreach (var check in command.Checks)
        {
            if (string.IsNullOrWhiteSpace(check.Statement) && string.IsNullOrWhiteSpace(check.Kind))
            {
                throw new CommandValidationException("Each check requires a Statement or Kind.");
            }

            if (!string.IsNullOrWhiteSpace(check.Kind))
            {
                try
                {
                    CheckDerivation.RequireKind(check.Kind);
                }
                catch (ArgumentException ex)
                {
                    throw new CommandValidationException(ex.Message);
                }
            }

            if (!seen.Add(check.Id))
            {
                throw new CommandValidationException($"Check {check.Id} is duplicated.");
            }
        }
    }

    [WolverinePost("/amend-capability-eval"), EmptyResponse]
    [AggregateHandler]
    public static MartenEvents Handle(AmendCapabilityEvalApi.Command command, Capability capability)
    {
        var evals = capability.Evals.ToList();
        var index = evals.FindIndex(e => e.Id == command.EvalId);
        var existing = evals[index];
        var criterion =
            capability.Criteria.FirstOrDefault(c => c.Id == existing.CriterionId)
            ?? throw new CommandValidationException(
                $"Criterion {existing.CriterionId} not found."
            );

        var scenario = command.Scenario.Trim();
        var scenarioChanged = !string.Equals(existing.Scenario, scenario, StringComparison.Ordinal);
        var checks = ResolveChecks(
            existing.Checks,
            command.Checks,
            criterion.Statement,
            scenario,
            scenarioChanged
        );

        evals[index] = new EvalSnapshot
        {
            Id = existing.Id,
            CriterionId = existing.CriterionId,
            Scenario = scenario,
            Prompt = command.Prompt.Trim(),
            Context = command.Context.Trim(),
            Checks = checks,
        };

        var snapshot = new CapabilityVersionSnapshot
        {
            Ask = capability.Ask,
            Criteria = capability.Criteria.ToArray(),
            Evals = evals,
        };

        if (capability.CapabilityContentEquals(snapshot))
        {
            return [];
        }

        return
        [
            new CapabilityLayersAmended
            {
                Ask = snapshot.Ask,
                Criteria = snapshot.Criteria,
                Evals = snapshot.Evals,
            },
            new CapabilityVersionRecorded
            {
                VersionId = Guid.NewGuid(),
                CapabilityId = capability.Id,
                RecordedAt = DateTimeOffset.UtcNow,
                Snapshot = snapshot,
            },
        ];
    }

    static IReadOnlyList<CheckSnapshot> ResolveChecks(
        IReadOnlyList<CheckSnapshot> existing,
        IReadOnlyList<CheckSnapshot>? requested,
        string criterionStatement,
        string scenario,
        bool scenarioChanged
    )
    {
        if (requested is null)
        {
            return scenarioChanged
                ? CheckDerivation.ReDerive(existing, criterionStatement, scenario)
                : existing.ToArray();
        }

        if (scenarioChanged)
        {
            // Keep ids and kinds from the request; re-author Script bodies behind the scenes.
            var withKinds = requested
                .Select(check =>
                {
            var kind = CheckDerivation.RequireKind(check.Kind);
            return kind == CheckKinds.HumanReview
                ? CheckDerivation.HumanReviewCheck(check.Id, criterionStatement)
                : CheckDerivation.ScriptCheck(check.Id, criterionStatement, scenario);
                })
                .ToArray();
            return withKinds;
        }

        return CheckDerivation.ApplyKindOverrides(
            existing,
            requested,
            criterionStatement,
            scenario
        );
    }
}
