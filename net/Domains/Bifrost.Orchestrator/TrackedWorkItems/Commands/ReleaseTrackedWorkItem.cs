using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class ReleaseTrackedWorkItemHandler
{
    public static void Validate(ReleaseTrackedWorkItemApi.Command command, TrackedWorkItem item)
    {
        item.EnsureExpected(command.Expected);
        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Release
        );
    }

    [WolverinePost("/release-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<TrackedWorkItemReleased> Handle(
        ReleaseTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = WorkItemLifecycleActors.ForSystem();
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Release
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

        return new TrackedWorkItemReleased { Actor = actor, Reason = command.Reason };
    }
}
