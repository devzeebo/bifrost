using System.Text.Json.Nodes;
using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class ReplaceWorkItemDataApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
    }
}
