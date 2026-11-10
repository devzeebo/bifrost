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
        CapabilityChatDocument chat,
        DerivationSuiteBasis? suiteBasis = null
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
            SuiteBasis = suiteBasis ?? new DerivationSuiteBasis(),
        };

    public static Proposal OfferProposal(
        CapabilityView.Model capability,
        string summary,
        IReadOnlyList<ProposalEffect> effects,
        string? compositionSummary = null,
        Guid? basisSuiteRunId = null
    ) =>
        new()
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTimeOffset.UtcNow,
            Summary = summary,
            CompositionSummary = compositionSummary,
            BasisSuiteRunId = basisSuiteRunId,
            ExpectedCapabilityVersionId = capability.CurrentCapabilityVersionId,
            ExpectedCapabilitySnapshot = new CapabilityVersionSnapshot
            {
                Ask = capability.Ask,
                Criteria = capability.Criteria,
                Evals = capability.Evals,
            },
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

    public static async Task<GetCapabilityChatApi.Response> ToResponseLive(
        CapabilityChatDocument chat,
        CapabilityView.Model capability,
        IQuerySession session
    )
    {
        var current = new CapabilityVersionSnapshot
        {
            Ask = capability.Ask,
            Criteria = capability.Criteria,
            Evals = capability.Evals,
        };
        var refreshed = new List<Proposal>();
        foreach (var proposal in chat.PendingProposals)
        {
            refreshed.Add(await RefreshProposalSummary(proposal, current, session));
        }

        return new GetCapabilityChatApi.Response
        {
            CapabilityId = chat.Id,
            Messages = chat.Messages,
            PendingProposals = refreshed,
        };
    }

    public static async Task<Proposal> RefreshProposalSummary(
        Proposal proposal,
        CapabilityVersionSnapshot current,
        IQuerySession session
    )
    {
        if (
            proposal.CompositionSummary is null
            && proposal.BasisSuiteRunId is null
            && !IsDerivationProposal(proposal)
        )
        {
            return proposal;
        }

        var composition =
            proposal.CompositionSummary
            ?? StripLiveAccount(proposal.Summary);

        if (proposal.BasisSuiteRunId is { } runId)
        {
            var basis = await DerivationSuiteBasis.LoadNamed(session, runId, current);
            if (basis.SuiteRunId is null)
            {
                // Named run gone or no longer completed — keep composition, note absence.
                return proposal with
                {
                    Summary = DerivationSummary.WithRunLessPlain(composition),
                };
            }

            return proposal with
            {
                Summary = DerivationSummary.Display(composition, basis),
                CompositionSummary = composition,
            };
        }

        if (proposal.CompositionSummary is not null || IsDerivationProposal(proposal))
        {
            return proposal with
            {
                Summary = DerivationSummary.WithRunLessPlain(composition),
                CompositionSummary = composition,
            };
        }

        return proposal;
    }

    public static bool IsDerivationProposal(Proposal proposal) =>
        proposal.Effects.Any(e => e.Kind == ProposalEffectKinds.ReplaceSkill)
        && proposal.Effects.All(e =>
            e.Kind
                is ProposalEffectKinds.ReplaceSkill
                    or ProposalEffectKinds.AmendAsk
                    or ProposalEffectKinds.SharpenCriterion
                    or ProposalEffectKinds.AddCriterion
                    or ProposalEffectKinds.RetireCriterion
                    or ProposalEffectKinds.AddEval
                    or ProposalEffectKinds.AmendEval
                    or ProposalEffectKinds.RetireEval
        );

    static string StripLiveAccount(string summary)
    {
        const string marker = " Basis suite run ";
        var index = summary.IndexOf(marker, StringComparison.Ordinal);
        return index < 0 ? summary : summary[..index];
    }
}
