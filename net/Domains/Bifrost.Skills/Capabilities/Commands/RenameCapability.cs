using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Wolverine.Marten;

namespace Bifrost.Capabilities.Commands;

public static class RenameCapabilityHandler
{
    public static void Validate(RenameCapabilityApi.Command command, Capability? capability)
    {
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (string.IsNullOrWhiteSpace(command.Name))
        {
            throw new CommandValidationException("Name is required.");
        }
    }

    [WolverinePost("/rename-capability"), EmptyResponse]
    [AggregateHandler]
    public static CapabilityRenamed Handle(
        RenameCapabilityApi.Command command,
        Capability capability
    ) => new() { Name = command.Name.Trim() };
}
