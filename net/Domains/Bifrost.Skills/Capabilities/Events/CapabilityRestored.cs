namespace Bifrost.Capabilities.Events;

public sealed record CapabilityRestored
{
    public required Guid VersionId { get; init; }
    public required CapabilityVersionSnapshot Snapshot { get; init; }
}
