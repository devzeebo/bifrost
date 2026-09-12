using System.Text.Json.Nodes;

namespace Bifrost.WorkItems.Events;

public sealed record WorkItemCreated
{
    public required Guid Id { get; init; }
    public required JsonNode Data { get; init; }
}
