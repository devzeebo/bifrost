using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Wolverine.Marten;

namespace Bifrost.Capabilities.Commands;

public static class AmendCapabilityAskHandler
{
    public static void Validate(AmendCapabilityAskApi.Command command, Capability capability)
    {
        if (string.IsNullOrWhiteSpace(command.Ask))
        {
            throw new CommandValidationException("Ask is required.");
        }
    }

    [WolverinePost("/amend-capability-ask"), EmptyResponse]
    [AggregateHandler]
    public static CapabilityAskAmended Handle(
        AmendCapabilityAskApi.Command command,
        Capability capability
    ) => new() { Ask = command.Ask.Trim() };
}
