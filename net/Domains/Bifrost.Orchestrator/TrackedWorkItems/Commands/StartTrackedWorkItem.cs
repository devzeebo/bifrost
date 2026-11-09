using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Marten;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class StartTrackedWorkItemHandler
{
    public static async Task Validate(
        StartTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IQuerySession session
    )
    {
        TrackedWorkItemSpeakers.EnsureHolder(item, command.Actor);
        await TrackedWorkItemSpeakers.EnsureRunForItem(
            command.RunId,
            command.Id,
            session,
            requireOpen: true
        );
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
        var actor = command.Actor;
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.Start
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
                    WorkItemLifecycleAction.Start,
                    from,
                    command.RunId
                ),
            },
            bus
        );

        return new TrackedWorkItemStarted { Actor = actor, Reason = command.Reason };
    }
}
