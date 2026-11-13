using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class BeginExecutingTrackedWorkItemHandler
{
    public static void Validate(
        BeginExecutingTrackedWorkItemApi.Command command,
        TrackedWorkItem item
    )
    {
        if (command.Actor != WorkItemLifecycleActors.Orchestrator)
        {
            throw new CommandValidationException(
                "Only the orchestrator may begin workflow execution on a tracked work item."
            );
        }

        item.EnsureExpected(command.Expected);
        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.BeginExecuting
        );
    }

    [WolverinePost("/begin-executing-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<TrackedWorkItemExecuting> Handle(
        BeginExecutingTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = WorkItemLifecycleActors.Orchestrator;
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.BeginExecuting
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
                    WorkItemLifecycleAction.BeginExecuting,
                    from
                ),
            },
            bus
        );

        return new TrackedWorkItemExecuting { Actor = actor, Reason = command.Reason };
    }
}
