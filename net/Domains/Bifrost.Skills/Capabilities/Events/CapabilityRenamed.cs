namespace Bifrost.Capabilities.Events;

public sealed record CapabilityRenamed
{
    public required string Name { get; init; }
}
