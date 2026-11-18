using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class CreateTrackedWorkItemApi
{
    public sealed record Command : TrackedWorkItemCommand
    {
        public required Guid Id { get; init; }

        /// <summary>
        /// When false, the item is tracked but not enqueued for worker dispatch
        /// (e.g. an externally managed executing root).
        /// </summary>
        public bool ScheduleDispatch { get; init; } = true;
    }
}
