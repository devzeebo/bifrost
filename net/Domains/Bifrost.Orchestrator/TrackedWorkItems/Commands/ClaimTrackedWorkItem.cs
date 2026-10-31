using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class ClaimTrackedWorkItemHandler
{
    public static void Validate(ClaimTrackedWorkItemApi.Command command, TrackedWorkItem item)
    {
        item.EnsureExpected(command.Expected);
        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Claim
        );
    }

    [WolverinePost("/claim-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<TrackedWorkItemClaimed> Handle(
        ClaimTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = WorkItemLifecycleActors.ForSystem();
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Claim
        );

        await MirrorWorkItemStatusHandler.Handle(
            new MirrorWorkItemStatusHandler.Message
            {
                Id = command.Id,
                Status = next,
                Actor = actor,
                Reason = command.Reason,
                ExpectedStatus = item.Status,
            },
            bus
        );

        return new TrackedWorkItemClaimed { Actor = actor, Reason = command.Reason };
    }
}
