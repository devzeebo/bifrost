using System.Text.Json.Nodes;

namespace Bifrost.WorkItems.Events;

public sealed record WorkItemMetadataReplaced
{
    public required JsonObject Metadata { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
