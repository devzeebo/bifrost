using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Capabilities.Commands;

public static class SaveDerivedSkillHandler
{
    public static void Validate(SaveDerivedSkillApi.Command command, Capability? capability)
    {
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (capability.CurrentCapabilityVersionId is null)
        {
            throw new CommandValidationException(
                "A capability version is required before saving a derived skill."
            );
        }
    }

    [WolverinePost("/save-derived-skill"), EmptyResponse]
    [AggregateHandler]
    public static MartenEvents Handle(SaveDerivedSkillApi.Command command, Capability capability)
    {
        var markdown = command.Markdown;
        var against = capability.CurrentCapabilityVersionId!.Value;
        var snapshot = new SkillVersionSnapshot
        {
            Markdown = markdown,
            DerivedAgainstCapabilityVersionId = against,
        };

        if (capability.SkillContentEquals(snapshot))
        {
            return [];
        }

        return
        [
            new DerivedSkillSaved
            {
                Markdown = markdown,
                DerivedAgainstCapabilityVersionId = against,
            },
            new SkillVersionRecorded
            {
                VersionId = Guid.NewGuid(),
                CapabilityId = capability.Id,
                RecordedAt = DateTimeOffset.UtcNow,
                Snapshot = snapshot,
            },
        ];
    }
}
