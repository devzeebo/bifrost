using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Bifrost.WorkItems.Events;

public sealed record WorkItemDataReplaced
{
    [JsonConstructor]
    internal WorkItemDataReplaced(JsonNode data) => Data = data;

    public JsonNode Data { get; init; }
}
