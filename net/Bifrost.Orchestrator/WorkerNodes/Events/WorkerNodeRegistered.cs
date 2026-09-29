namespace Bifrost.WorkerNodes.Events;

public sealed record WorkerNodeRegistered
{
    public required Guid Id { get; init; }
}
