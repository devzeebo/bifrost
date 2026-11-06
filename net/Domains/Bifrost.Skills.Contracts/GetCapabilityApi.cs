using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class GetCapabilityApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record CriterionSummary
    {
        public required Guid Id { get; init; }
        public required string Statement { get; init; }
    }

    public sealed record CheckSummary
    {
        public required Guid Id { get; init; }
        public required string Statement { get; init; }
        public string Kind { get; init; } = CheckKinds.Script;
        public string? Script { get; init; }
    }

    public sealed record EvalSummary
    {
        public required Guid Id { get; init; }
        public required Guid CriterionId { get; init; }
        public required string Scenario { get; init; }
        public string Prompt { get; init; } = "";
        public string Context { get; init; } = "";
        public IReadOnlyList<CheckSummary> Checks { get; init; } = [];
    }

    public sealed record Response
    {
        public required Guid Id { get; init; }
        public required string Name { get; init; }
        public required string Ask { get; init; }
        public required IReadOnlyList<CriterionSummary> Criteria { get; init; }
        public required IReadOnlyList<EvalSummary> Evals { get; init; }
        public bool HasPublishedSkill { get; init; }
        public string SkillMarkdown { get; init; } = "";
        public Guid? CurrentCapabilityVersionId { get; init; }
        public Guid? CurrentSkillVersionId { get; init; }
        public Guid? DerivedAgainstCapabilityVersionId { get; init; }
        public bool HasUnsavedCapabilityDraft { get; init; }
        public bool HasUnsavedSkillDraft { get; init; }
    }
}
