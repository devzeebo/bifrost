using System.Text.Json.Nodes;
using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class CreateRunApi
{
    public sealed record Command : RunCommand
    {
        public required Guid Id { get; init; }
        public required Guid WorkItemId { get; init; }
        public JsonNode? Data { get; init; }
        public JsonObject? Metadata { get; init; }
    }
}
