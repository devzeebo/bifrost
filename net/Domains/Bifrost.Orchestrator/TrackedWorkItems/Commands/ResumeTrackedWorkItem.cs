using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Marten;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class ResumeTrackedWorkItemHandler
{
    public static async Task Validate(
        ResumeTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IQuerySession session
    )
    {
        TrackedWorkItemSpeakers.EnsureHolderOrSystem(item, command.Actor);
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
            WorkItemLifecycleAction.Resume
        );
    }

    [WolverinePost("/resume-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<TrackedWorkItemResumed> Handle(
        ResumeTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = command.Actor;
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.Resume
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
                    WorkItemLifecycleAction.Resume,
                    from,
                    command.RunId,
                    item.HoldCount
                ),
            },
            bus
        );

        return new TrackedWorkItemResumed { Actor = actor, Reason = command.Reason };
    }
}
