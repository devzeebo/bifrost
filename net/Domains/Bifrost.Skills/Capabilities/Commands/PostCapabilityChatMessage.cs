using Bifrost.Capabilities.Chat;
using Bifrost.Capabilities.Editor;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class PostCapabilityChatMessageHandler
{
    public static async Task Validate(
        PostCapabilityChatMessageApi.Command command,
        IQuerySession session
    )
    {
        if (string.IsNullOrWhiteSpace(command.Message))
        {
            throw new CommandValidationException("Message is required.");
        }

        if (await session.LoadAsync<CapabilityView.Model>(command.Id) is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }
    }

    [WolverinePost("/post-capability-chat-message")]
    public static async Task<PostCapabilityChatMessageApi.Response> Handle(
        PostCapabilityChatMessageApi.Command command,
        IDocumentSession session,
        ICapabilityEditor editor,
        CancellationToken ct
    )
    {
        var capability = (await session.LoadAsync<CapabilityView.Model>(command.Id))!;
        var chat = await CapabilityChatStore.LoadOrCreate(session, command.Id);
        var current = new CapabilityVersionSnapshot
        {
            Ask = capability.Ask,
            Criteria = capability.Criteria,
            Evals = capability.Evals,
        };
        var suiteBasis = await DerivationSuiteBasis.Load(session, capability.Id, current);

        var userMessage = CapabilityChatStore.Message("user", command.Message.Trim());
        chat.Messages.Add(userMessage);

        var turn = await editor.Compose(
            CapabilityChatStore.ToEditorContext(capability, chat, suiteBasis),
            command.Message.Trim(),
            ct
        );

        Proposal? proposal = null;
        string? validationNote = null;
        if (turn.Effects is { Count: > 0 } && !string.IsNullOrWhiteSpace(turn.ProposalSummary))
        {
            try
            {
                ProposalApplicator.ValidateEffects(
                    current,
                    capability.SkillMarkdown,
                    turn.Effects
                );

                var compositionSummary = turn.CompositionSummary ?? turn.ProposalSummary;
                var basisRunId = turn.BasisSuiteRunId;
                // Derive turns that omit basis inherit the compose-time suite basis when they draft skill.
                if (
                    basisRunId is null
                    && turn.CompositionSummary is not null
                    && suiteBasis.SuiteRunId is not null
                )
                {
                    basisRunId = suiteBasis.SuiteRunId;
                }

                var display =
                    basisRunId is not null
                        ? DerivationSummary.Display(
                            compositionSummary,
                            await DerivationSuiteBasis.LoadNamed(session, basisRunId.Value, current)
                        )
                        : turn.CompositionSummary is not null
                            ? DerivationSummary.WithRunLessPlain(compositionSummary)
                            : turn.ProposalSummary!;

                proposal = CapabilityChatStore.OfferProposal(
                    capability,
                    display,
                    turn.Effects,
                    turn.CompositionSummary is not null ? compositionSummary : null,
                    basisRunId
                );
                chat.PendingProposals.Add(proposal);
            }
            catch (CommandValidationException ex)
            {
                validationNote =
                    $"The collaborator offered an invalid proposal and it was not queued: {ex.Message}";
            }
        }

        var assistant = CapabilityChatStore.Message(
            "assistant",
            turn.AssistantText,
            proposal?.Id
        );
        chat.Messages.Add(assistant);
        if (validationNote is not null)
        {
            chat.Messages.Add(CapabilityChatStore.Message("system", validationNote));
        }
        session.Store(chat);

        return new PostCapabilityChatMessageApi.Response
        {
            AssistantMessage = assistant,
            Proposal = proposal,
            Messages = chat.Messages,
            PendingProposals = chat.PendingProposals,
        };
    }
}
