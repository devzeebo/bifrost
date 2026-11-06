using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Bifrost.Capabilities.Projections;
using Marten;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Capabilities.Commands;

public static class RestoreCapabilityVersionHandler
{
    public static async Task Validate(
        RestoreCapabilityVersionApi.Command command,
        Capability? capability,
        IQuerySession session
    )
    {
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        var version = await session.LoadAsync<CapabilityVersionView.Model>(command.VersionId);
        if (version is null || version.CapabilityId != command.Id)
        {
            throw new CommandValidationException(
                $"Capability version {command.VersionId} not found."
            );
        }
    }

    [WolverinePost("/restore-capability-version"), EmptyResponse]
    [AggregateHandler]
    public static async Task<MartenEvents> Handle(
        RestoreCapabilityVersionApi.Command command,
        Capability capability,
        IDocumentSession session
    )
    {
        var version = (await session.LoadAsync<CapabilityVersionView.Model>(command.VersionId))!;
        return
        [
            new CapabilityRestored
            {
                VersionId = version.Id,
                Snapshot = version.Snapshot,
            },
        ];
    }
}
