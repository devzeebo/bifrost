using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class GetCapabilityChatApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid CapabilityId { get; init; }
        public required IReadOnlyList<ChatMessage> Messages { get; init; }
        public required IReadOnlyList<Proposal> PendingProposals { get; init; }
    }
}
