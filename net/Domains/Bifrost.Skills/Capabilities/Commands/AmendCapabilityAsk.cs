using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Wolverine.Marten;
using MartenEvents = Wolverine.Marten.Events;

namespace Bifrost.Capabilities.Commands;

public static class AmendCapabilityAskHandler
{
    public static void Validate(AmendCapabilityAskApi.Command command, Capability? capability)
    {
        if (capability is null)
        {
            throw new CommandValidationException($"Capability {command.Id} not found.");
        }

        if (string.IsNullOrWhiteSpace(command.Ask))
        {
            throw new CommandValidationException("Ask is required.");
        }
    }

    [WolverinePost("/amend-capability-ask"), EmptyResponse]
    [AggregateHandler]
    public static MartenEvents Handle(AmendCapabilityAskApi.Command command, Capability capability)
    {
        var ask = command.Ask.Trim();
        var snapshot = new CapabilityVersionSnapshot
        {
            Ask = ask,
            Criteria = capability.Criteria.ToArray(),
            Evals = capability.Evals.ToArray(),
        };

        if (capability.CapabilityContentEquals(snapshot))
        {
            return [];
        }

        return
        [
            new CapabilityAskAmended { Ask = ask },
            new CapabilityVersionRecorded
            {
                VersionId = Guid.NewGuid(),
                CapabilityId = capability.Id,
                RecordedAt = DateTimeOffset.UtcNow,
                Snapshot = snapshot,
            },
        ];
    }
}
