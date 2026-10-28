using System.Text.Json.Nodes;
using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class GetRunApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid Id { get; init; }
        public required Guid WorkItemId { get; init; }
        public RunOutcome? Outcome { get; init; }
        public required JsonNode Data { get; init; }
        public required JsonObject Metadata { get; init; }
    }
}
