using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class SucceedRunApi
{
    public sealed record Command : RunCommand
    {
        public required Guid Id { get; init; }
    }
}
