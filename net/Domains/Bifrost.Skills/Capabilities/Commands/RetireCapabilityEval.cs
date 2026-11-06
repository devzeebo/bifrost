using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class RetireCapabilityEvalHandler
{
    public static async Task Validate(
        RetireCapabilityEvalApi.Command command,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<CapabilityView.Model>(command.Id) is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }
    }

    [WolverinePost("/retire-capability-eval")]
    public static async Task<RetireCapabilityEvalApi.Response> Handle(
        RetireCapabilityEvalApi.Command command,
        IDocumentSession session
    )
    {
        var stream = await session.Events.FetchForWriting<Capability>(command.Id);
        var capability =
            stream.Aggregate
            ?? throw new CommandValidationException($"Capability {command.Id} not found.");

        var retiring =
            capability.Evals.FirstOrDefault(e => e.Id == command.EvalId)
            ?? throw new CommandValidationException($"Eval {command.EvalId} not found.");

        var remainingForCriterion = capability.Evals.Count(e =>
            e.CriterionId == retiring.CriterionId && e.Id != command.EvalId
        );
        var leftUncovered = remainingForCriterion == 0;

        var evals = capability.Evals.Where(e => e.Id != command.EvalId).ToArray();
        var snapshot = new CapabilityVersionSnapshot
        {
            Ask = capability.Ask,
            Criteria = capability.Criteria.ToArray(),
            Evals = evals,
        };

        stream.AppendMany(
            new CapabilityLayersAmended
            {
                Ask = snapshot.Ask,
                Criteria = snapshot.Criteria,
                Evals = snapshot.Evals,
            }
        );
        stream.AppendMany(
            new CapabilityVersionRecorded
            {
                VersionId = Guid.NewGuid(),
                CapabilityId = capability.Id,
                RecordedAt = DateTimeOffset.UtcNow,
                Snapshot = snapshot,
            }
        );

        return new RetireCapabilityEvalApi.Response
        {
            LeftCriterionUncovered = leftUncovered,
            UncoveredCriterionId = leftUncovered ? retiring.CriterionId : null,
            Note = leftUncovered
                ? $"Retired the last eval behind criterion {retiring.CriterionId}; that criterion is now uncovered."
                : null,
        };
    }
}
