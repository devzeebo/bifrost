using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class DeleteWorkItemApi
{
    public sealed record Command : WorkItemCommand
    {
        public required Guid Id { get; init; }
    }
}
