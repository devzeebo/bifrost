using Bifrost.MessageBus;

namespace Bifrost.Tests.MessageBus;

public static class EchoApi
{
    public sealed record Command
    {
        public required string Payload { get; init; }
    }

    public sealed record Response
    {
        public required string Value { get; init; }
    }
}

public sealed record StatusChangedEvent
{
    public required string Status { get; init; }
}
