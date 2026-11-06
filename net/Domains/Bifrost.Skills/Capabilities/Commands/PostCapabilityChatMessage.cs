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

        var userMessage = CapabilityChatStore.Message("user", command.Message.Trim());
        chat.Messages.Add(userMessage);

        var turn = await editor.Compose(
            CapabilityChatStore.ToEditorContext(capability, chat),
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
                    new CapabilityVersionSnapshot
                    {
                        Ask = capability.Ask,
                        Criteria = capability.Criteria,
                        Evals = capability.Evals,
                    },
                    capability.SkillMarkdown,
                    turn.Effects
                );
                proposal = CapabilityChatStore.OfferProposal(
                    capability,
                    turn.ProposalSummary,
                    turn.Effects
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
