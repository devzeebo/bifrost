using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class StartTrackedWorkItemHandler
{
    public static void Validate(StartTrackedWorkItemApi.Command command, TrackedWorkItem item)
    {
        item.EnsureExpected(command.Expected);
        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Start
        );
    }

    [WolverinePost("/start-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<TrackedWorkItemStarted> Handle(
        StartTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = WorkItemLifecycleActors.ForSystem();
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Start
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

        return new TrackedWorkItemStarted { Actor = actor, Reason = command.Reason };
    }
}
