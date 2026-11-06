namespace Bifrost.Capabilities.Events;

public sealed record CapabilityLayersAmended
{
    public required string Ask { get; init; }
    public required IReadOnlyList<CriterionSnapshot> Criteria { get; init; }
    public required IReadOnlyList<EvalSnapshot> Evals { get; init; }
}
