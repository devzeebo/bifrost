using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class PostCapabilityChatMessageApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required string Message { get; init; }
    }

    public sealed record Response
    {
        public required ChatMessage AssistantMessage { get; init; }
        public Proposal? Proposal { get; init; }
        public required IReadOnlyList<ChatMessage> Messages { get; init; }
        public required IReadOnlyList<Proposal> PendingProposals { get; init; }
    }
}
