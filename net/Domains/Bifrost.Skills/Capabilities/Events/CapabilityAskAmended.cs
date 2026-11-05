namespace Bifrost.Capabilities.Events;

public sealed record CapabilityAskAmended
{
    public required string Ask { get; init; }
}
