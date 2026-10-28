using System.Text.Json.Nodes;
using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class ReplaceRunDataApi
{
    public sealed record Command : RunCommand
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
    }
}
