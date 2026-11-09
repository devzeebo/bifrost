using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Marten;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class FailTrackedWorkItemHandler
{
    public static async Task Validate(
        FailTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IQuerySession session
    )
    {
        TrackedWorkItemSpeakers.EnsureHolderOrSystem(item, command.Actor);
        await TrackedWorkItemSpeakers.EnsureRunForItem(
            command.RunId,
            command.Id,
            session,
            requireOpen: false
        );
        item.EnsureExpected(command.Expected);
        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Fail
        );
    }

    [WolverinePost("/fail-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<TrackedWorkItemFailed> Handle(
        FailTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = command.Actor;
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.Fail
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
                    WorkItemLifecycleAction.Fail,
                    from,
                    command.RunId
                ),
            },
            bus
        );

        return new TrackedWorkItemFailed { Actor = actor, Reason = command.Reason };
    }
}
