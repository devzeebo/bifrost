using System.Text.Json.Nodes;
using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class CreateWorkItemApi
{
    public sealed record Command : WorkItemCommand
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
        public required WorkItemStatus Status { get; init; }
    }
}
