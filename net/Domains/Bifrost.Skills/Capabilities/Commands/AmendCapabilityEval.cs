using Bifrost.Capabilities.Chat;
using Bifrost.Capabilities.Editor;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class AmendCapabilityEvalHandler
{
    public static async Task Validate(
        AmendCapabilityEvalApi.Command command,
        IQuerySession session
    )
    {
        var capability = await session.LoadAsync<CapabilityView.Model>(command.Id);
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (capability.Evals.All(e => e.Id != command.EvalId))
        {
            throw new CommandValidationException($"Eval {command.EvalId} not found.");
        }

        if (string.IsNullOrWhiteSpace(command.Scenario))
        {
            throw new CommandValidationException("Scenario is required.");
        }

        if (command.Checks is { Count: 0 })
        {
            throw new CommandValidationException("At least one check is required.");
        }

        if (command.Checks is null)
        {
            return;
        }

        var seen = new HashSet<Guid>();
        foreach (var check in command.Checks)
        {
            if (string.IsNullOrWhiteSpace(check.Statement) && string.IsNullOrWhiteSpace(check.Kind))
            {
                throw new CommandValidationException("Each check requires a Statement or Kind.");
            }

            if (!string.IsNullOrWhiteSpace(check.Kind))
            {
                try
                {
                    CheckDerivation.RequireKind(check.Kind);
                }
                catch (ArgumentException ex)
                {
                    throw new CommandValidationException(ex.Message);
                }
            }

            if (!seen.Add(check.Id))
            {
                throw new CommandValidationException($"Check {check.Id} is duplicated.");
            }
        }
    }

    [WolverinePost("/amend-capability-eval")]
    public static async Task<AmendCapabilityEvalApi.Response> Handle(
        AmendCapabilityEvalApi.Command command,
        IDocumentSession session
    )
    {
        var capability =
            await session.LoadAsync<CapabilityView.Model>(command.Id)
            ?? throw new CommandValidationException($"Capability {command.Id} not found.");

        var composition = LayerSyncComposer.FromEvalEdit(
            new CapabilityVersionSnapshot
            {
                Ask = capability.Ask,
                Criteria = capability.Criteria,
                Evals = capability.Evals,
            },
            command.EvalId,
            command.Scenario,
            command.Prompt,
            command.Context,
            command.Checks,
            capability.SkillMarkdown
        );

        var result = await HandLayerSave.ProposeOrApply(command.Id, composition, session);
        return new AmendCapabilityEvalApi.Response
        {
            Outcome = result.Outcome,
            Proposal = result.Proposal,
            Messages = result.Messages,
            PendingProposals = result.PendingProposals,
        };
    }
}
