using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Marten;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Capabilities.Commands;

public static class RenameCapabilityHandler
{
    public static async Task Validate(
        RenameCapabilityApi.Command command,
        Capability? capability,
        IQuerySession session
    )
    {
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (string.IsNullOrWhiteSpace(command.Name))
        {
            throw new CommandValidationException("Name is required.");
        }

        await CapabilityNames.EnsureAvailable(session, command.Name.Trim(), command.Id);
    }

    [WolverinePost("/rename-capability"), EmptyResponse]
    [AggregateHandler]
    public static MartenEvents Handle(RenameCapabilityApi.Command command, Capability capability)
    {
        var name = command.Name.Trim();
        if (name == capability.Name)
        {
            return [];
        }

        return [new CapabilityRenamed { Name = name }];
    }
}
