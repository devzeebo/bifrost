using System.Text.Json.Nodes;

namespace Bifrost.WorkItems.Events;

public sealed record WorkItemDataReplaced
{
    public required JsonNode Data { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
