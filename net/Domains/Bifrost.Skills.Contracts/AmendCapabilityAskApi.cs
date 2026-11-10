using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class AmendCapabilityAskApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required string Ask { get; init; }
    }

    public sealed record Response
    {
        /// <summary>Applied | Proposed | Unchanged</summary>
        public required string Outcome { get; init; }
        public Proposal? Proposal { get; init; }
        public IReadOnlyList<ChatMessage> Messages { get; init; } = [];
        public IReadOnlyList<Proposal> PendingProposals { get; init; } = [];
    }
}
