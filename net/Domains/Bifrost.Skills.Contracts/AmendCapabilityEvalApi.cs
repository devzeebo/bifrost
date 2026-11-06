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
        /// <summary>
        /// Optional. When omitted, existing checks are kept (re-derived if Scenario changed).
        /// When provided, ids/kinds drive identity and Script↔HumanReview swap; Script bodies
        /// are authored behind the scenes when needed — never person-written.
        /// </summary>
        public IReadOnlyList<CheckSnapshot>? Checks { get; init; }
    }
}
