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

    /// <summary>Script | HumanReview. Defaults to Script for legacy snapshots.</summary>
    public string Kind { get; init; } = CheckKinds.Script;

    /// <summary>TypeScript source when Kind is Script; null/empty for HumanReview.</summary>
    public string? Script { get; init; }

    /// <summary>
    /// Optional per-check execution ceiling in milliseconds. Null uses the skills-service default.
    /// </summary>
    public int? TimeoutMs { get; init; }
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
