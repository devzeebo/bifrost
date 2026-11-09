using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class FailTrackedWorkItemHandler
{
    public static void Validate(FailTrackedWorkItemApi.Command command, TrackedWorkItem item)
    {
        TrackedWorkItemSpeakers.EnsureRunId(command.RunId);
        TrackedWorkItemSpeakers.EnsureHolderOrSystem(item, command.Actor);
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
