using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Editor;
using Bifrost.Capabilities.Events;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Chat;

/// <summary>
/// Propose-or-apply for hand layer saves: when sync would move another layer's wording,
/// offer one chat proposal and record nothing until accept; otherwise apply directly.
/// </summary>
public static class HandLayerSave
{
    public sealed record Result
    {
        public required string Outcome { get; init; }
        public Proposal? Proposal { get; init; }
        public required IReadOnlyList<ChatMessage> Messages { get; init; }
        public required IReadOnlyList<Proposal> PendingProposals { get; init; }
    }

    public static async Task<Result> ProposeOrApply(
        Guid capabilityId,
        LayerSyncComposer.Composition composition,
        IDocumentSession session
    )
    {
        var stream = await session.Events.FetchForWriting<Capability>(capabilityId);
        var capability =
            stream.Aggregate
            ?? throw new CommandValidationException($"Capability {capabilityId} not found.");

        var current = capability.DraftCapabilitySnapshot();
        ProposalApplicator.ValidateEffects(current, capability.SkillMarkdown, composition.Effects);

        var (next, _, capabilityChanged, _) = ProposalApplicator.Apply(
            current,
            capability.SkillMarkdown,
            new Proposal
            {
                Id = Guid.Empty,
                CreatedAt = DateTimeOffset.UtcNow,
                Summary = composition.Summary,
                ExpectedSkillMarkdown = capability.SkillMarkdown,
                Effects = composition.Effects,
            }
        );

        // Compare against the last recorded version, not only the live draft — a restored
        // draft that matches the intended edit still needs an explicit save to version.
        if (capability.CapabilityContentEquals(next))
        {
            var chatUnchanged = await CapabilityChatStore.LoadOrCreate(session, capabilityId);
            return new Result
            {
                Outcome = "Unchanged",
                Messages = chatUnchanged.Messages,
                PendingProposals = chatUnchanged.PendingProposals,
            };
        }

        var view = ToView(capability);
        var chat = await CapabilityChatStore.LoadOrCreate(session, capabilityId);

        if (composition.RequiresProposal && capabilityChanged)
        {
            var proposal = CapabilityChatStore.OfferProposal(
                view,
                composition.Summary,
                composition.Effects
            );
            chat.PendingProposals.Add(proposal);
            chat.Messages.Add(
                CapabilityChatStore.Message(
                    "system",
                    $"Hand save proposed sync: {composition.Summary}",
                    proposal.Id
                )
            );
            session.Store(chat);

            return new Result
            {
                Outcome = "Proposed",
                Proposal = proposal,
                Messages = chat.Messages,
                PendingProposals = chat.PendingProposals,
            };
        }

        if (capabilityChanged)
        {
            stream.AppendMany(
                new CapabilityLayersAmended
                {
                    Ask = next.Ask,
                    Criteria = next.Criteria,
                    Evals = next.Evals,
                }
            );
        }

        stream.AppendMany(
            new CapabilityVersionRecorded
            {
                VersionId = Guid.NewGuid(),
                CapabilityId = capability.Id,
                RecordedAt = DateTimeOffset.UtcNow,
                Snapshot = next,
            }
        );

        chat.Messages.Add(
            CapabilityChatStore.Message("system", $"Applied hand save: {composition.Summary}")
        );
        session.Store(chat);

        return new Result
        {
            Outcome = "Applied",
            Messages = chat.Messages,
            PendingProposals = chat.PendingProposals,
        };
    }

    static CapabilityView.Model ToView(Capability capability) =>
        new()
        {
            Id = capability.Id,
            Name = capability.Name,
            Ask = capability.Ask,
            Criteria = capability.Criteria,
            Evals = capability.Evals,
            SkillMarkdown = capability.SkillMarkdown,
            CurrentCapabilityVersionId = capability.CurrentCapabilityVersionId,
            CurrentSkillVersionId = capability.CurrentSkillVersionId,
            DerivedAgainstCapabilityVersionId = capability.DerivedAgainstCapabilityVersionId,
            DerivedAgainstSuiteRunId = capability.DerivedAgainstSuiteRunId,
        };
}
