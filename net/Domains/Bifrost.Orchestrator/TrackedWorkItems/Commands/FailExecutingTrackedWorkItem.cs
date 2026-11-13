using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class FailExecutingTrackedWorkItemHandler
{
    public static void Validate(
        FailExecutingTrackedWorkItemApi.Command command,
        TrackedWorkItem item
    )
    {
        if (command.Actor != WorkItemLifecycleActors.Orchestrator)
        {
            throw new CommandValidationException(
                "Only the orchestrator may fail an executing workflow work item."
            );
        }

        item.EnsureExpected(command.Expected);
        if (TrackedWorkItemStatuses.Normalize(item.Status) != TrackedWorkItemStatuses.Executing)
        {
            throw new CommandValidationException(
                $"Cannot fail executing work item from status '{item.Status}'."
            );
        }

        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Fail
        );
    }

    [WolverinePost("/fail-executing-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<TrackedWorkItemFailed> Handle(
        FailExecutingTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = WorkItemLifecycleActors.Orchestrator;
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
                    from
                ),
            },
            bus
        );

        return new TrackedWorkItemFailed { Actor = actor, Reason = command.Reason };
    }
}
