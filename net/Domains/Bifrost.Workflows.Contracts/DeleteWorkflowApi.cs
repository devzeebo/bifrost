using Bifrost.MessageBus;

namespace Bifrost.Workflows.Contracts;

[BusAddress("workflows")]
public static class DeleteWorkflowApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }
}
