using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Chat;

public sealed class CapabilityChatDocument
{
    public Guid Id { get; set; }
    public List<ChatMessage> Messages { get; set; } = [];
    public List<Proposal> PendingProposals { get; set; } = [];
}
