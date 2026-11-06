using Bifrost.Capabilities.Chat;
using Bifrost.Capabilities.Editor;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class RereadCapabilityProposalHandler
{
    public static async Task Validate(
        RereadCapabilityProposalApi.Command command,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<CapabilityView.Model>(command.Id) is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }
    }

    [WolverinePost("/reread-capability-proposal")]
    public static async Task<RereadCapabilityProposalApi.Response> Handle(
        RereadCapabilityProposalApi.Command command,
        IDocumentSession session,
        ICapabilityEditor editor,
        CancellationToken ct
    )
    {
        var capability = (await session.LoadAsync<CapabilityView.Model>(command.Id))!;
        var chat = await CapabilityChatStore.LoadOrCreate(session, command.Id);
        var stale =
            chat.PendingProposals.FirstOrDefault(p => p.Id == command.ProposalId)
            ?? throw new CommandValidationException(
                $"Proposal {command.ProposalId} not found."
            );

        chat.PendingProposals.RemoveAll(p => p.Id == command.ProposalId);

        var turn = await editor.Reread(
            CapabilityChatStore.ToEditorContext(capability, chat),
            stale,
            ct
        );

        if (turn.Effects is { Count: > 0 } && !string.IsNullOrWhiteSpace(turn.ProposalSummary))
        {
            try
            {
                ProposalApplicator.ValidateEffects(
                    new CapabilityVersionSnapshot
                    {
                        Ask = capability.Ask,
                        Criteria = capability.Criteria,
                        Evals = capability.Evals,
                    },
                    capability.SkillMarkdown,
                    turn.Effects
                );
            }
            catch (CommandValidationException ex)
            {
                var invalidNote =
                    turn.WithdrawNote
                    ?? $"Withdrawn after re-read: updated proposal was invalid ({ex.Message}).";
                chat.Messages.Add(CapabilityChatStore.Message("system", invalidNote, stale.Id));
                session.Store(chat);
                return new RereadCapabilityProposalApi.Response
                {
                    Outcome = "Withdrawn",
                    Note = invalidNote,
                    Messages = chat.Messages,
                    PendingProposals = chat.PendingProposals,
                };
            }

            var reoffered = CapabilityChatStore.OfferProposal(
                capability,
                turn.ProposalSummary,
                turn.Effects
            );
            chat.PendingProposals.Add(reoffered);
            chat.Messages.Add(
                CapabilityChatStore.Message("assistant", turn.AssistantText, reoffered.Id)
            );
            session.Store(chat);

            return new RereadCapabilityProposalApi.Response
            {
                Outcome = "Reoffered",
                Note = turn.AssistantText,
                Proposal = reoffered,
                Messages = chat.Messages,
                PendingProposals = chat.PendingProposals,
            };
        }

        var note = turn.WithdrawNote ?? turn.AssistantText;
        chat.Messages.Add(CapabilityChatStore.Message("system", note, stale.Id));
        session.Store(chat);

        return new RereadCapabilityProposalApi.Response
        {
            Outcome = "Withdrawn",
            Note = note,
            Messages = chat.Messages,
            PendingProposals = chat.PendingProposals,
        };
    }
}
