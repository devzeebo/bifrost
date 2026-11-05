using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Wolverine.Marten;

namespace Bifrost.Capabilities.Commands;

public static class ChangeCapabilityAskHandler
{
    public static void Validate(ChangeCapabilityAskApi.Command command, Capability capability)
    {
        if (string.IsNullOrWhiteSpace(command.Ask))
        {
            throw new CommandValidationException("Ask is required.");
        }
    }

    [WolverinePost("/change-capability-ask"), EmptyResponse]
    [AggregateHandler]
    public static CapabilityAskChanged Handle(
        ChangeCapabilityAskApi.Command command,
        Capability capability
    ) => new() { Ask = command.Ask.Trim() };
}
