using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class BeginExecutingTrackedWorkItemApi
{
    public sealed record Command : TrackedWorkItemCommand
    {
        public required Guid Id { get; init; }
    }
}
