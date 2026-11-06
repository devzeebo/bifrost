using Bifrost.Capabilities.Editor;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Chat;

public static class CapabilityChatStore
{
    public static async Task<CapabilityChatDocument> LoadOrCreate(
        IDocumentSession session,
        Guid capabilityId
    )
    {
        var existing = await session.LoadAsync<CapabilityChatDocument>(capabilityId);
        if (existing is not null)
        {
            return existing;
        }

        return new CapabilityChatDocument { Id = capabilityId };
    }

    public static EditorContext ToEditorContext(
        CapabilityView.Model capability,
        CapabilityChatDocument chat
    ) =>
        new()
        {
            CapabilityId = capability.Id,
            Name = capability.Name,
            Ask = capability.Ask,
            Criteria = capability.Criteria,
            Evals = capability.Evals,
            SkillMarkdown = capability.SkillMarkdown,
            CurrentCapabilityVersionId = capability.CurrentCapabilityVersionId,
            Messages = chat.Messages,
        };

    public static Proposal OfferProposal(
        CapabilityView.Model capability,
        string summary,
        IReadOnlyList<ProposalEffect> effects
    ) =>
        new()
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
            Summary = summary,
            ExpectedCapabilityVersionId = capability.CurrentCapabilityVersionId,
            ExpectedSkillMarkdown = capability.SkillMarkdown,
            Effects = effects,
        };

    public static ChatMessage Message(string role, string text, Guid? proposalId = null) =>
        new()
        {
            Id = Guid.NewGuid(),
            At = DateTimeOffset.UtcNow,
            Role = role,
            Text = text,
            ProposalId = proposalId,
        };

    public static GetCapabilityChatApi.Response ToResponse(CapabilityChatDocument chat) =>
        new()
        {
            CapabilityId = chat.Id,
            Messages = chat.Messages,
            PendingProposals = chat.PendingProposals,
        };
}
