using System.Text.Json.Nodes;

namespace Bifrost.Runs.Events;

public sealed record RunMetadataReplaced
{
    public required JsonObject Metadata { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
