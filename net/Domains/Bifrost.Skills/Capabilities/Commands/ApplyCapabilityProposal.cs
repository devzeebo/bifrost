using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Chat;
using Bifrost.Capabilities.Editor;
using Bifrost.Capabilities.Events;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class ApplyCapabilityProposalHandler
{
    public static async Task Validate(
        ApplyCapabilityProposalApi.Command command,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<CapabilityView.Model>(command.Id) is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        var chat = await session.LoadAsync<CapabilityChatDocument>(command.Id);
        if (chat?.PendingProposals.Any(p => p.Id == command.ProposalId) != true)
        {
            throw new CommandValidationException($"Proposal {command.ProposalId} not found.");
        }
    }

    [WolverinePost("/apply-capability-proposal")]
    public static async Task<ApplyCapabilityProposalApi.Response> Handle(
        ApplyCapabilityProposalApi.Command command,
        IDocumentSession session,
        ICapabilityEditor editor,
        CancellationToken ct
    )
    {
        var stream = await session.Events.FetchForWriting<Capability>(command.Id);
        var capability =
            stream.Aggregate
            ?? throw new CommandValidationException($"Capability {command.Id} not found.");

        var chat = await CapabilityChatStore.LoadOrCreate(session, command.Id);
        var proposal =
            chat.PendingProposals.FirstOrDefault(p => p.Id == command.ProposalId)
            ?? throw new CommandValidationException($"Proposal {command.ProposalId} not found.");

        var currentSnapshot = capability.DraftCapabilitySnapshot();
        if (
            proposal.IsStale
            || !ProposalApplicator.IsFresh(
                proposal,
                capability.CurrentCapabilityVersionId,
                currentSnapshot,
                capability.SkillMarkdown
            )
        )
        {
            return await StalePath(capability, chat, proposal, session, editor, ct);
        }

        proposal = await CapabilityChatStore.RefreshProposalSummary(
            proposal,
            currentSnapshot,
            session
        );

        var (nextCapability, skillMarkdown, capabilityChanged, skillChanged) =
            ProposalApplicator.Apply(currentSnapshot, capability.SkillMarkdown, proposal);

        var uncoveredCriteria = ProposalApplicator.CriteriaLeftUncoveredByRetire(
            currentSnapshot.Evals,
            nextCapability.Evals,
            nextCapability.Criteria,
            proposal.Effects
        );

        var capabilityVersionId = capability.CurrentCapabilityVersionId;

        if (capabilityChanged)
        {
            stream.AppendMany(
                new CapabilityLayersAmended
                {
                    Ask = nextCapability.Ask,
                    Criteria = nextCapability.Criteria,
                    Evals = nextCapability.Evals,
                }
            );

            if (!capability.CapabilityContentEquals(nextCapability))
            {
                capabilityVersionId = Guid.NewGuid();
                stream.AppendMany(
                    new CapabilityVersionRecorded
                    {
                        VersionId = capabilityVersionId.Value,
                        CapabilityId = capability.Id,
                        RecordedAt = DateTimeOffset.UtcNow,
                        Snapshot = nextCapability,
                    }
                );
            }
        }

        if (skillChanged && skillMarkdown is not null)
        {
            var against =
                capabilityVersionId
                ?? throw new CommandValidationException(
                    "A capability version is required before saving a derived skill."
                );

            var skillSnapshot = new SkillVersionSnapshot
            {
                Markdown = skillMarkdown,
                DerivedAgainstCapabilityVersionId = against,
                DerivedAgainstSuiteRunId = proposal.BasisSuiteRunId,
            };

            stream.AppendMany(
                new DerivedSkillSaved
                {
                    Markdown = skillMarkdown,
                    DerivedAgainstCapabilityVersionId = against,
                    DerivedAgainstSuiteRunId = proposal.BasisSuiteRunId,
                }
            );

            if (!capability.SkillContentEquals(skillSnapshot))
            {
                stream.AppendMany(
                    new SkillVersionRecorded
                    {
                        VersionId = Guid.NewGuid(),
                        CapabilityId = capability.Id,
                        RecordedAt = DateTimeOffset.UtcNow,
                        Snapshot = skillSnapshot,
                    }
                );
            }
        }

        chat.PendingProposals.RemoveAll(p => p.Id == proposal.Id);
        if (capabilityChanged || skillChanged)
        {
            chat.PendingProposals =
            [
                .. chat.PendingProposals.Select(p =>
                    p with
                    {
                        IsStale = true,
                        StaleNote =
                            "Another proposal was applied; re-read before applying this one.",
                    }
                ),
            ];
        }
        var appliedNote = $"Applied proposal: {proposal.Summary}";
        if (uncoveredCriteria.Count > 0)
        {
            var names = string.Join("; ", uncoveredCriteria.Select(c => c.Statement));
            appliedNote +=
                $" Warning: retiring eval(s) left criterion(s) uncovered: {names}.";
        }

        chat.Messages.Add(CapabilityChatStore.Message("system", appliedNote, proposal.Id));
        session.Store(chat);

        return new ApplyCapabilityProposalApi.Response
        {
            Outcome = "Applied",
            Note = appliedNote,
            Messages = chat.Messages,
            PendingProposals = chat.PendingProposals,
        };
    }

    static async Task<ApplyCapabilityProposalApi.Response> StalePath(
        Capability capability,
        CapabilityChatDocument chat,
        Proposal proposal,
        IDocumentSession session,
        ICapabilityEditor editor,
        CancellationToken ct
    )
    {
        chat.PendingProposals.RemoveAll(p => p.Id == proposal.Id);

        var view = new CapabilityView.Model
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

        var suiteBasis = await DerivationSuiteBasis.Load(
            session,
            capability.Id,
            capability.DraftCapabilitySnapshot()
        );
        var turn = await editor.Reread(
            CapabilityChatStore.ToEditorContext(view, chat, suiteBasis),
            proposal with
            {
                IsStale = true,
                StaleNote = "Capability changed while this proposal was pending.",
            },
            ct
        );

        if (turn.Effects is { Count: > 0 } && !string.IsNullOrWhiteSpace(turn.ProposalSummary))
        {
            try
            {
                ProposalApplicator.ValidateEffects(
                    capability.DraftCapabilitySnapshot(),
                    capability.SkillMarkdown,
                    turn.Effects
                );
            }
            catch (CommandValidationException ex)
            {
                var invalidNote =
                    turn.WithdrawNote
                    ?? $"Withdrawn: re-offered proposal was invalid ({ex.Message}).";
                chat.Messages.Add(CapabilityChatStore.Message("system", invalidNote, proposal.Id));
                session.Store(chat);
                return new ApplyCapabilityProposalApi.Response
                {
                    Outcome = "Withdrawn",
                    Note = invalidNote,
                    Messages = chat.Messages,
                    PendingProposals = chat.PendingProposals,
                };
            }

            var reoffered = CapabilityChatStore.OfferProposal(
                view,
                turn.ProposalSummary,
                turn.Effects,
                turn.CompositionSummary ?? proposal.CompositionSummary,
                turn.BasisSuiteRunId ?? proposal.BasisSuiteRunId
            );
            chat.PendingProposals.Add(reoffered);
            chat.Messages.Add(
                CapabilityChatStore.Message("assistant", turn.AssistantText, reoffered.Id)
            );
            session.Store(chat);

            return new ApplyCapabilityProposalApi.Response
            {
                Outcome = "Reoffered",
                Note = turn.AssistantText,
                Proposal = reoffered,
                Messages = chat.Messages,
                PendingProposals = chat.PendingProposals,
            };
        }

        var note =
            turn.WithdrawNote
            ?? "Withdrawn: the proposal was stale and could not be re-offered.";
        chat.Messages.Add(CapabilityChatStore.Message("system", note, proposal.Id));
        session.Store(chat);

        return new ApplyCapabilityProposalApi.Response
        {
            Outcome = "Withdrawn",
            Note = note,
            Messages = chat.Messages,
            PendingProposals = chat.PendingProposals,
        };
    }
}
