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
    }
}
