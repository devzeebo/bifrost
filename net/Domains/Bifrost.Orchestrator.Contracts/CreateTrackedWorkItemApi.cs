using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class CreateTrackedWorkItemApi
{
    public sealed record Command : TrackedWorkItemCommand
    {
        public required Guid Id { get; init; }
    }
}
