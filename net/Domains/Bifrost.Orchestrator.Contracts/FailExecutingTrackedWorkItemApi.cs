using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

/// <summary>
/// Conclude an Orchestrator-carried attached root (status <c>executing</c>) as failed.
/// No Run belongs to the root.
/// </summary>
[BusAddress("orchestrator")]
public static class FailExecutingTrackedWorkItemApi
{
    public sealed record Command : TrackedWorkItemCommand
    {
        public required Guid Id { get; init; }
    }
}
