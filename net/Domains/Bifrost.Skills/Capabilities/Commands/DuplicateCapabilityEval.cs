using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Capabilities.Commands;

public static class DuplicateCapabilityEvalHandler
{
    public static void Validate(DuplicateCapabilityEvalApi.Command command, Capability? capability)
    {
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (capability.Evals.All(e => e.Id != command.SourceEvalId))
        {
            throw new CommandValidationException($"Eval {command.SourceEvalId} not found.");
        }

        if (capability.Evals.Any(e => e.Id == command.NewEvalId))
        {
            throw new CommandValidationException($"Eval {command.NewEvalId} already exists.");
        }
    }

    [WolverinePost("/duplicate-capability-eval"), EmptyResponse]
    [AggregateHandler]
    public static MartenEvents Handle(
        DuplicateCapabilityEvalApi.Command command,
        Capability capability
    )
    {
        var source = capability.Evals.First(e => e.Id == command.SourceEvalId);
        var evals = capability.Evals.ToList();
        evals.Add(
            new EvalSnapshot
            {
                Id = command.NewEvalId,
                CriterionId = source.CriterionId,
                Scenario = source.Scenario,
                Prompt = source.Prompt,
                Context = source.Context,
                Checks =
                [
                    .. source.Checks.Select(check => new CheckSnapshot
                    {
                        Id = Guid.NewGuid(),
                        Statement = check.Statement,
                        Kind = check.Kind,
                        Script = check.Script,
                        TimeoutMs = check.TimeoutMs,
                    }),
                ],
            }
        );

        var snapshot = new CapabilityVersionSnapshot
        {
            Ask = capability.Ask,
            Criteria = capability.Criteria.ToArray(),
            Evals = evals,
        };

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
