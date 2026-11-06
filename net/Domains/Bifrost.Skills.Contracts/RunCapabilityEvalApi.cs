using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class RunCapabilityEvalApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required Guid EvalId { get; init; }

        /// <summary>When null, runs against the capability's current draft skill markdown.</summary>
        public Guid? SkillVersionId { get; init; }
    }

    public sealed record Response
    {
        public required EvalCaseRunSummary Run { get; init; }
    }
}
