using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Bifrost.Capabilities.Projections;
using Marten;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Capabilities.Commands;

public static class RestoreSkillVersionHandler
{
    public static async Task Validate(
        RestoreSkillVersionApi.Command command,
        Capability? capability,
        IQuerySession session
    )
    {
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        var version = await session.LoadAsync<SkillVersionView.Model>(command.VersionId);
        if (version is null || version.CapabilityId != command.Id)
        {
            throw new CommandValidationException($"Skill version {command.VersionId} not found.");
        }
    }

    [WolverinePost("/restore-skill-version"), EmptyResponse]
    [AggregateHandler]
    public static async Task<MartenEvents> Handle(
        RestoreSkillVersionApi.Command command,
        Capability capability,
        IDocumentSession session
    )
    {
        var version = (await session.LoadAsync<SkillVersionView.Model>(command.VersionId))!;
        return
        [
            new SkillRestored
            {
                VersionId = version.Id,
                Snapshot = version.Snapshot,
            },
        ];
    }
}
