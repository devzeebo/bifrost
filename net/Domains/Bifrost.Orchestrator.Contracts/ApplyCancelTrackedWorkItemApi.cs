using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

/// <summary>
/// Cancels a tracked work item without attached-root child discovery.
/// Used after Workflows has already canceled children (or for non-root items).
/// </summary>
[BusAddress("orchestrator")]
public static class ApplyCancelTrackedWorkItemApi
{
    public sealed record Command : TrackedWorkItemCommand
    {
        public required Guid Id { get; init; }
    }
}
