using System.Text.Json.Nodes;

namespace Bifrost.WorkItems.Contracts;

public static class ReplaceWorkItemDataApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
    }
}
