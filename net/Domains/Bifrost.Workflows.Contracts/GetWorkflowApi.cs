using Bifrost.MessageBus;

namespace Bifrost.Workflows.Contracts;

[BusAddress("workflows")]
public static class GetWorkflowApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid Id { get; init; }
        public required string Name { get; init; }
        public required long Version { get; init; }
        public required IReadOnlyList<WorkflowNode> Nodes { get; init; }
        public required IReadOnlyList<WorkflowConnection> Connections { get; init; }
    }
}
