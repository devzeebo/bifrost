using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class GetCapabilityEvalOutcomesApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid CapabilityId { get; init; }
        public required SuiteEvalSummary Suite { get; init; }
        public required IReadOnlyList<CriterionEvalRollup> Criteria { get; init; }
        public required IReadOnlyList<EvalLatestOutcome> Evals { get; init; }
    }
}
