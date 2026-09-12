using System.Text.Json.Nodes;

namespace Bifrost.Domain.WorkItems.Events;

public sealed record WorkItemDataReplaced
{
    public required JsonNode Data { get; init; }
}
