using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class RetireCapabilityEvalApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required Guid EvalId { get; init; }
    }

    public sealed record Response
    {
        public required bool LeftCriterionUncovered { get; init; }
        public Guid? UncoveredCriterionId { get; init; }
        public string? Note { get; init; }
    }
}
