using System.Text.Json.Nodes;
using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class ReplaceWorkItemMetadataApi
{
    public sealed record Command : WorkItemCommand
    {
        public required Guid Id { get; init; }
        public required JsonObject Metadata { get; init; }
    }
}
