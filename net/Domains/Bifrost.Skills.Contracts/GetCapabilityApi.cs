using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class GetCapabilityApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    /// <summary>Placeholder until criteria land in a later story.</summary>
    public sealed record CriterionSummary
    {
        public required Guid Id { get; init; }
        public required string Statement { get; init; }
    }

    /// <summary>Placeholder until evals land in a later story.</summary>
    public sealed record EvalSummary
    {
        public required Guid Id { get; init; }
        public required Guid CriterionId { get; init; }
        public required string Scenario { get; init; }
    }

    public sealed record Response
    {
        public required Guid Id { get; init; }
        public required string Name { get; init; }
        public required string Ask { get; init; }
        public required IReadOnlyList<CriterionSummary> Criteria { get; init; }
        public required IReadOnlyList<EvalSummary> Evals { get; init; }
        public bool HasPublishedSkill { get; init; }
    }
}
