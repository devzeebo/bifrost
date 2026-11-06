namespace Bifrost.Skills.Contracts;

public sealed record ProposalEffect
{
    /// <summary>
    /// AmendAsk | AddCriterion | SharpenCriterion | SplitCriterion | RetireCriterion | AddEval | AmendEval | RetireEval | ReplaceSkill
    /// </summary>
    public required string Kind { get; init; }
    public string? Description { get; init; }
    public string? Ask { get; init; }
    public Guid? CriterionId { get; init; }
    public string? Statement { get; init; }
    public IReadOnlyList<CriterionSnapshot>? NewCriteria { get; init; }
    public Guid? EvalId { get; init; }
    public string? Scenario { get; init; }
    public string? Markdown { get; init; }
    public IReadOnlyList<Guid>? ServedCriterionIds { get; init; }
}

public sealed record Proposal
{
    public required Guid Id { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public required string Summary { get; init; }
    public Guid? ExpectedCapabilityVersionId { get; init; }
    public required string ExpectedSkillMarkdown { get; init; }
    public required IReadOnlyList<ProposalEffect> Effects { get; init; }
    public bool IsStale { get; init; }
    public string? StaleNote { get; init; }
}

public sealed record ChatMessage
{
    public required Guid Id { get; init; }
    public required DateTimeOffset At { get; init; }
    public required string Role { get; init; }
    public required string Text { get; init; }
    public Guid? ProposalId { get; init; }
}
