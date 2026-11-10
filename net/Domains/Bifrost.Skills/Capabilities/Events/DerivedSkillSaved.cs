namespace Bifrost.Capabilities.Events;

public sealed record DerivedSkillSaved
{
    public required string Markdown { get; init; }
    public required Guid DerivedAgainstCapabilityVersionId { get; init; }
    public Guid? DerivedAgainstSuiteRunId { get; init; }
}
