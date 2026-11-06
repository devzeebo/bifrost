using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class RereadCapabilityProposalApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required Guid ProposalId { get; init; }
    }

    public sealed record Response
    {
        /// <summary>Reoffered | Withdrawn</summary>
        public required string Outcome { get; init; }
        public string? Note { get; init; }
        public Proposal? Proposal { get; init; }
        public required IReadOnlyList<ChatMessage> Messages { get; init; }
        public required IReadOnlyList<Proposal> PendingProposals { get; init; }
    }
}
