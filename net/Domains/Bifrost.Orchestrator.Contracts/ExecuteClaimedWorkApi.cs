using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

/// <summary>
/// Durable handoff of a claimed item to one worker node. Not a lifecycle event —
/// delivery is intentionally unrecorded in the item history.
/// </summary>
[BusAddress("worker")]
public static class ExecuteClaimedWorkApi
{
    public sealed record Command : INodeAffinity
    {
        public required Guid WorkItemId { get; init; }
        public required Guid WorkerId { get; init; }
        public required Guid RunId { get; init; }

        public string? Node => WorkerId.ToString("D");
    }
}
