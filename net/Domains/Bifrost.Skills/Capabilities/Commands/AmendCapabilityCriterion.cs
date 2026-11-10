using Bifrost.Capabilities.Chat;
using Bifrost.Capabilities.Editor;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class AmendCapabilityCriterionHandler
{
    public static async Task Validate(
        AmendCapabilityCriterionApi.Command command,
        IQuerySession session
    )
    {
        var capability = await session.LoadAsync<CapabilityView.Model>(command.Id);
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (capability.Criteria.All(c => c.Id != command.CriterionId))
        {
            throw new CommandValidationException($"Criterion {command.CriterionId} not found.");
        }

        if (string.IsNullOrWhiteSpace(command.Statement))
        {
            throw new CommandValidationException("Statement is required.");
        }
    }

    [WolverinePost("/amend-capability-criterion")]
    public static async Task<AmendCapabilityCriterionApi.Response> Handle(
        AmendCapabilityCriterionApi.Command command,
        IDocumentSession session
    )
    {
        var capability =
            await session.LoadAsync<CapabilityView.Model>(command.Id)
            ?? throw new CommandValidationException($"Capability {command.Id} not found.");

        var composition = LayerSyncComposer.FromCriterionEdit(
            new CapabilityVersionSnapshot
            {
                Ask = capability.Ask,
                Criteria = capability.Criteria,
                Evals = capability.Evals,
            },
            command.CriterionId,
            command.Statement
        );

        var result = await HandLayerSave.ProposeOrApply(command.Id, composition, session);
        return new AmendCapabilityCriterionApi.Response
        {
            Outcome = result.Outcome,
            Proposal = result.Proposal,
            Messages = result.Messages,
            PendingProposals = result.PendingProposals,
        };
    }
}
