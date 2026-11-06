using Bifrost.Capabilities.Chat;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class DismissCapabilityProposalHandler
{
    public static async Task Validate(
        DismissCapabilityProposalApi.Command command,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<CapabilityView.Model>(command.Id) is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }
    }

    [WolverinePost("/dismiss-capability-proposal")]
    public static async Task<DismissCapabilityProposalApi.Response> Handle(
        DismissCapabilityProposalApi.Command command,
        IDocumentSession session
    )
    {
        var chat = await CapabilityChatStore.LoadOrCreate(session, command.Id);
        var proposal =
            chat.PendingProposals.FirstOrDefault(p => p.Id == command.ProposalId)
            ?? throw new CommandValidationException(
                $"Proposal {command.ProposalId} not found."
            );

        chat.PendingProposals.RemoveAll(p => p.Id == command.ProposalId);
        chat.Messages.Add(
            CapabilityChatStore.Message(
                "system",
                $"Dismissed proposal: {proposal.Summary}",
                proposal.Id
            )
        );
        session.Store(chat);

        return new DismissCapabilityProposalApi.Response
        {
            Messages = chat.Messages,
            PendingProposals = chat.PendingProposals,
        };
    }
}
