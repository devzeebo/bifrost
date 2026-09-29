using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Bifrost.WorkItems.Events;

public sealed record WorkItemCreated
{
    [JsonConstructor]
    internal WorkItemCreated(Guid id, JsonNode data, WorkItemStatus status)
    {
        Id = id;
        Data = data;
        Status = status;
    }

    public Guid Id { get; init; }
    public JsonNode Data { get; init; }
    public WorkItemStatus Status { get; init; }
}
