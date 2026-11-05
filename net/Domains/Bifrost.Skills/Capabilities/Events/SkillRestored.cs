namespace Bifrost.Capabilities.Events;

public sealed record SkillRestored
{
    public required Guid VersionId { get; init; }
    public required SkillVersionSnapshot Snapshot { get; init; }
}
