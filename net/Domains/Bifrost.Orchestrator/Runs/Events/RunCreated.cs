using System.Text.Json.Nodes;

namespace Bifrost.Runs.Events;

public sealed record RunCreated
{
    public required Guid Id { get; init; }
    public required Guid WorkItemId { get; init; }
    public required JsonNode Data { get; init; }
    public required JsonObject Metadata { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
