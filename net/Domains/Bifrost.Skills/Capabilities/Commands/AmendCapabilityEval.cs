using Bifrost.Capabilities.Aggregate;
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

        if (command.Checks.Count == 0)
        {
            throw new CommandValidationException("At least one check is required.");
        }

        var seen = new HashSet<Guid>();
        foreach (var check in command.Checks)
        {
            if (string.IsNullOrWhiteSpace(check.Statement))
            {
                throw new CommandValidationException("Each check requires a Statement.");
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

        evals[index] = new EvalSnapshot
        {
            Id = existing.Id,
            CriterionId = existing.CriterionId,
            Scenario = command.Scenario.Trim(),
            Prompt = command.Prompt.Trim(),
            Context = command.Context.Trim(),
            Checks =
            [
                .. command.Checks.Select(check => new CheckSnapshot
                {
                    Id = check.Id,
                    Statement = check.Statement.Trim(),
                }),
            ],
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
}
