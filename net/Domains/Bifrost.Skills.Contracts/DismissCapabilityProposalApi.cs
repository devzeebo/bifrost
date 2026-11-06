using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class DismissCapabilityProposalApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required Guid ProposalId { get; init; }
    }

    public sealed record Response
    {
        public required IReadOnlyList<ChatMessage> Messages { get; init; }
        public required IReadOnlyList<Proposal> PendingProposals { get; init; }
    }
}
