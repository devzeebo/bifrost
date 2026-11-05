namespace Bifrost.Capabilities.Events;

public sealed record CapabilityAskChanged
{
    public required string Ask { get; init; }
}
