using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

/// <summary>
/// Durable instruction to kill leftover harness processes for one abandoned attempt.
/// Not a lifecycle event — delivery and consumption are intentionally unrecorded.
/// </summary>
[BusAddress("worker")]
public static class KillHarnessProcessesApi
{
    public sealed record Command : INodeAffinity
    {
        public required Guid WorkerId { get; init; }
        public required Guid WorkItemId { get; init; }
        public required Guid RunId { get; init; }

        public string? Node => WorkerId.ToString("D");
    }
}
