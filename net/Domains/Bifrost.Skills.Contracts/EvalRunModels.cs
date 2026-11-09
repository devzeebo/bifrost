namespace Bifrost.Skills.Contracts;

public static class EvalCaseRunStatuses
{
    public const string Running = "running";
    public const string Completed = "completed";
    public const string NeverCompleted = "never_completed";
}

public static class EvalSuiteRunStatuses
{
    public const string Running = "running";
    public const string Completed = "completed";
    public const string Canceled = "canceled";
}

public static class EvalOutcomeStatuses
{
    public const string Passed = "passed";
    public const string Failed = "failed";
    public const string Unsettled = "unsettled";
    public const string NeverCompleted = "never_completed";
    public const string NeverRun = "never_run";
}

public static class EvalCheckVerdictStatuses
{
    public const string Passed = "passed";
    public const string Failed = "failed";
    public const string Unsettled = "unsettled";
}

public sealed record TranscriptLine
{
    public required string Role { get; init; }
    public required string Text { get; init; }
}

public sealed record EvalSpend
{
    public required string Model { get; init; }
    public int InputTokens { get; init; }
    public int OutputTokens { get; init; }
    public int TotalTokens { get; init; }
    public double? Cost { get; init; }
}

public sealed record EvalCheckVerdict
{
    public required Guid CheckId { get; init; }
    public required string Statement { get; init; }
    public required string Kind { get; init; }
    public required string Status { get; init; }
    public required string Reason { get; init; }
}

public sealed record EvalCaseRunSummary
{
    public required Guid Id { get; init; }
    public required Guid CapabilityId { get; init; }
    public required Guid EvalId { get; init; }
    public required Guid CriterionId { get; init; }
    public Guid? SuiteRunId { get; init; }
    public Guid? SkillVersionId { get; init; }
    public Guid? CapabilityVersionId { get; init; }
    public required bool IsEval { get; init; }
    public required string Status { get; init; }
    public string? Outcome { get; init; }
    public string? FailureReason { get; init; }
    public required IReadOnlyList<TranscriptLine> Transcript { get; init; }
    public EvalSpend? Spend { get; init; }
    public required IReadOnlyList<EvalCheckVerdict> Checks { get; init; }
    public required DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
}

public sealed record EvalLatestOutcome
{
    public required Guid EvalId { get; init; }
    public required Guid CriterionId { get; init; }
    public required string Status { get; init; }
    public Guid? CaseRunId { get; init; }
    public Guid? CapabilityVersionId { get; init; }
    public Guid? SkillVersionId { get; init; }
}

public sealed record CriterionEvalRollup
{
    public required Guid CriterionId { get; init; }
    public int Passed { get; init; }
    public int Failed { get; init; }
    public int Unsettled { get; init; }
    public int NeverCompleted { get; init; }
    public int NeverRun { get; init; }
}

public sealed record SuiteEvalSummary
{
    public int Passed { get; init; }
    public int Failed { get; init; }
    public int Unsettled { get; init; }
    public int NeverCompleted { get; init; }
    public int NeverRun { get; init; }
}
