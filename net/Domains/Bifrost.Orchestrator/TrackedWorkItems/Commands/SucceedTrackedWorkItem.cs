using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Bifrost.TrackedWorkItems.Workflow;
using Bifrost.Workflows.Contracts;
using Bifrost.WorkItems.Contracts;
using Marten;
using Wolverine;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class SucceedTrackedWorkItemHandler
{
    public static async Task Validate(
        SucceedTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IQuerySession session
    )
    {
        TrackedWorkItemSpeakers.EnsureHolder(item, command.Actor);
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
            WorkItemLifecycleAction.Succeed
        );
    }

    [WolverinePost("/succeed-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<(TrackedWorkItemSucceeded Succeeded, OutgoingMessages Cascades)> Handle(
        SucceedTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = command.Actor;
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.Succeed
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
                    WorkItemLifecycleAction.Succeed,
                    from,
                    command.RunId
                ),
            },
            bus
        );

        var cascades = new OutgoingMessages();
        await MaybeAdvanceParentWorkflow(bus, command.Id, cascades).ConfigureAwait(false);

        return (
            new TrackedWorkItemSucceeded { Actor = actor, Reason = command.Reason },
            cascades
        );
    }

    internal static async Task MaybeAdvanceParentWorkflow(
        IBifrostBus bus,
        Guid workItemId,
        OutgoingMessages cascades
    )
    {
        var ledger = await bus.Request<GetWorkItemApi.Query, GetWorkItemApi.Response>(
            new GetWorkItemApi.Query { Id = workItemId }
        );
        if (
            WorkItemInputDefaults.TryReadRootWorkItemId(ledger.Metadata, out var rootWorkItemId)
        )
        {
            cascades.Add(new AdvanceWorkflowExecution { RootWorkItemId = rootWorkItemId });
        }
    }
}
