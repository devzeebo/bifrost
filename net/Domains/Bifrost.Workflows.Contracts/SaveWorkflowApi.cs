using Bifrost.MessageBus;

namespace Bifrost.Workflows.Contracts;

[BusAddress("workflows")]
public static class SaveWorkflowApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required string Name { get; init; }
        public required IReadOnlyList<WorkflowNode> Nodes { get; init; }
        public IReadOnlyList<WorkflowConnection> Connections { get; init; } = [];
        public required long ExpectedVersion { get; init; }
        public bool Overwrite { get; init; }
    }
}
