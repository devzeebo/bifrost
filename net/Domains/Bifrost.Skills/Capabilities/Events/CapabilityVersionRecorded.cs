namespace Bifrost.Capabilities.Events;

public sealed record CapabilityVersionRecorded
{
    public required Guid VersionId { get; init; }
    public required Guid CapabilityId { get; init; }
    public required DateTimeOffset RecordedAt { get; init; }
    public required CapabilityVersionSnapshot Snapshot { get; init; }
}
