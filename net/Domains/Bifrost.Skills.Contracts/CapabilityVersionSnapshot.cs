namespace Bifrost.Skills.Contracts;

public sealed record CriterionSnapshot
{
    public required Guid Id { get; init; }
    public required string Statement { get; init; }
}

public sealed record CheckSnapshot
{
    public required Guid Id { get; init; }
    public required string Statement { get; init; }
}

public sealed record EvalSnapshot
{
    public required Guid Id { get; init; }
    public required Guid CriterionId { get; init; }
    public required string Scenario { get; init; }
    public string Prompt { get; init; } = "";
    public string Context { get; init; } = "";
    public IReadOnlyList<CheckSnapshot> Checks { get; init; } = [];
}

public sealed record CapabilityVersionSnapshot
{
    public required string Ask { get; init; }
    public required IReadOnlyList<CriterionSnapshot> Criteria { get; init; }
    public required IReadOnlyList<EvalSnapshot> Evals { get; init; }
}

public sealed record SkillVersionSnapshot
{
    public required string Markdown { get; init; }
    public required Guid DerivedAgainstCapabilityVersionId { get; init; }
}
