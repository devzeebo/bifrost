namespace Bifrost.Capabilities.Events;

public sealed record SkillVersionRecorded
{
    public required Guid VersionId { get; init; }
    public required Guid CapabilityId { get; init; }
    public required DateTimeOffset RecordedAt { get; init; }
    public required SkillVersionSnapshot Snapshot { get; init; }
}
