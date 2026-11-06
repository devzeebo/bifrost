using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class AmendCapabilityEvalApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required Guid EvalId { get; init; }
        public required string Scenario { get; init; }
        public required string Prompt { get; init; }
        public required string Context { get; init; }
        public required IReadOnlyList<CheckSnapshot> Checks { get; init; }
    }
}
