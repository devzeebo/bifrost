namespace Bifrost.Capabilities.Events;

public sealed record CapabilityCreated
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required string Ask { get; init; }
}
