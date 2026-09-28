using System.Text.Json.Nodes;

namespace Bifrost.DataPlane.Contracts;

public static class CreateWorkItemApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
        public required WorkItemStatus Status { get; init; }
    }
}
