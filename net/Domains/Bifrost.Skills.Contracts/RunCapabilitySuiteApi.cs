using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class RunCapabilitySuiteApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }

        /// <summary>When null, runs against the capability's current draft skill markdown.</summary>
        public Guid? SkillVersionId { get; init; }

        /// <summary>When null or empty, runs every active eval on the capability.</summary>
        public IReadOnlyList<Guid>? EvalIds { get; init; }
    }

    public sealed record Response
    {
        public required Guid SuiteRunId { get; init; }
        public required string Status { get; init; }
        public required SuiteEvalSummary Summary { get; init; }
        public required IReadOnlyList<EvalCaseRunSummary> Cases { get; init; }
    }
}
