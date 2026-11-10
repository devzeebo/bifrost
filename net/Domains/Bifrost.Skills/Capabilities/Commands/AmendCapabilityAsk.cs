using Bifrost.Capabilities.Chat;
using Bifrost.Capabilities.Editor;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class AmendCapabilityAskHandler
{
    public static async Task Validate(
        AmendCapabilityAskApi.Command command,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<CapabilityView.Model>(command.Id) is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (string.IsNullOrWhiteSpace(command.Ask))
        {
            throw new CommandValidationException("Ask is required.");
        }
    }

    [WolverinePost("/amend-capability-ask")]
    public static async Task<AmendCapabilityAskApi.Response> Handle(
        AmendCapabilityAskApi.Command command,
        IDocumentSession session
    )
    {
        var capability =
            await session.LoadAsync<CapabilityView.Model>(command.Id)
            ?? throw new CommandValidationException($"Capability {command.Id} not found.");

        var composition = LayerSyncComposer.FromAskEdit(
            new CapabilityVersionSnapshot
            {
                Ask = capability.Ask,
                Criteria = capability.Criteria,
                Evals = capability.Evals,
            },
            command.Ask
        );

        var result = await HandLayerSave.ProposeOrApply(command.Id, composition, session);
        return new AmendCapabilityAskApi.Response
        {
            Outcome = result.Outcome,
            Proposal = result.Proposal,
            Messages = result.Messages,
            PendingProposals = result.PendingProposals,
        };
    }
}
