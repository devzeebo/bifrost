using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class GetEvalSuiteRunApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid SuiteRunId { get; init; }
        public required Guid CapabilityId { get; init; }
        public Guid? SkillVersionId { get; init; }
        public required string Status { get; init; }
        public required bool CancelRequested { get; init; }
        public required SuiteEvalSummary Summary { get; init; }
        public required IReadOnlyList<EvalCaseRunSummary> Cases { get; init; }
        public required DateTimeOffset StartedAt { get; init; }
        public DateTimeOffset? CompletedAt { get; init; }
    }
}
