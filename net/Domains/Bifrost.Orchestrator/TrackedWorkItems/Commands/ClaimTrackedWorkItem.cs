using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Dispatch;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Wolverine;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class ClaimTrackedWorkItemHandler
{
    public static void Validate(ClaimTrackedWorkItemApi.Command command, TrackedWorkItem item)
    {
        if (command.WorkerId == Guid.Empty)
        {
            throw new CommandValidationException("WorkerId is required.");
        }

        item.EnsureExpected(command.Expected);
        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Claim
        );
    }

    [WolverinePost("/claim-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<(TrackedWorkItemClaimed Claimed, OutgoingMessages Cascades)> Handle(
        ClaimTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = WorkItemLifecycleActors.ForSystem();
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.Claim
        );

        await MirrorWorkItemStatusHandler.Handle(
            new MirrorWorkItemStatusHandler.Message
            {
                Id = command.Id,
                Status = next,
                Actor = actor,
                Reason = command.Reason,
                ExpectedStatus = from,
                RequestKey = MirrorRequestKeys.For(
                    command.Id,
                    WorkItemLifecycleAction.Claim,
                    from
                ),
            },
            bus
        );

        var runId = Guid.NewGuid();
        var cascades = new OutgoingMessages
        {
            new CreateRunApi.Command
            {
                Id = runId,
                WorkItemId = command.Id,
                Actor = actor,
                Reason = command.Reason,
            },
            new DeliverClaimedWork
            {
                WorkItemId = command.Id,
                WorkerId = command.WorkerId,
                RunId = runId,
            },
        };

        return (
            new TrackedWorkItemClaimed
            {
                WorkerId = command.WorkerId,
                Actor = actor,
                Reason = command.Reason,
            },
            cascades
        );
    }
}
