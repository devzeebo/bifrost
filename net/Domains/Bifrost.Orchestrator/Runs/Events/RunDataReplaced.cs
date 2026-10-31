using System.Text.Json.Nodes;

namespace Bifrost.Runs.Events;

public sealed record RunDataReplaced
{
    public required JsonNode Data { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
