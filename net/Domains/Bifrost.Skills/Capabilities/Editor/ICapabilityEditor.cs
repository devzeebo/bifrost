using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Editor;

public sealed record EditorContext
{
    public required Guid CapabilityId { get; init; }
    public required string Name { get; init; }
    public required string Ask { get; init; }
    public required IReadOnlyList<CriterionSnapshot> Criteria { get; init; }
    public required IReadOnlyList<EvalSnapshot> Evals { get; init; }
    public required string SkillMarkdown { get; init; }
    public Guid? CurrentCapabilityVersionId { get; init; }
    public required IReadOnlyList<ChatMessage> Messages { get; init; }
    public DerivationSuiteBasis SuiteBasis { get; init; } = new();
}

public sealed record EditorTurn
{
    public required string AssistantText { get; init; }
    public string? ProposalSummary { get; init; }
    public string? CompositionSummary { get; init; }
    public Guid? BasisSuiteRunId { get; init; }
    public IReadOnlyList<ProposalEffect>? Effects { get; init; }
    public string? WithdrawNote { get; init; }
}

public interface ICapabilityEditor
{
    Task<EditorTurn> Compose(EditorContext context, string userMessage, CancellationToken ct);
    Task<EditorTurn> Reread(EditorContext context, Proposal stale, CancellationToken ct);
}
