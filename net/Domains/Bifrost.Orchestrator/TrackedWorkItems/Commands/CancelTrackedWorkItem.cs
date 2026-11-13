using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Projections;
using Bifrost.TrackedWorkItems.Services;
using Bifrost.TrackedWorkItems.Workflow;
using Marten;
using Wolverine;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class CancelTrackedWorkItemHandler
{
    [WolverinePost("/cancel-tracked-work-item"), EmptyResponse]
    public static async Task Handle(
        CancelTrackedWorkItemApi.Command command,
        IQuerySession session,
        IMessageBus bus
    )
    {
        var view =
            await session.LoadAsync<TrackedWorkItemView.Model>(command.Id)
            ?? throw new CommandValidationException($"Tracked work item {command.Id} not found.");

        EnsureExpected(view, command.Expected);
        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            view.Status,
            WorkItemLifecycleAction.Cancel
        );

        var actor = WorkItemLifecycleActors.ForRequester(command.Actor);

        if (view.Status == TrackedWorkItemStatuses.Executing)
        {
            // Sequential local queue with AdvanceWorkflowExecution — do not list children inline.
            await bus.SendAsync(
                    new CancelAttachedWorkflowRoot
                    {
                        RootWorkItemId = command.Id,
                        Actor = actor,
                        Reason = command.Reason,
                    }
                )
                .ConfigureAwait(false);
            return;
        }

        await bus.InvokeAsync(
                new ApplyCancelTrackedWorkItem
                {
                    Id = command.Id,
                    Actor = actor,
                    Reason = command.Reason,
                    Expected = command.Expected,
                }
            )
            .ConfigureAwait(false);
    }

    [AggregateHandler]
    public static async Task<(TrackedWorkItemCanceled Canceled, OutgoingMessages Cascades)> Handle(
        ApplyCancelTrackedWorkItem command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        item.EnsureExpected(command.Expected);
        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Cancel
        );

        var actor = command.Actor;
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.Cancel
        );

        var cascades = new OutgoingMessages();

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
                    WorkItemLifecycleAction.Cancel,
                    from
                ),
            },
            bus
        );

        await SucceedTrackedWorkItemHandler
            .MaybeAdvanceParentWorkflow(bus, command.Id, cascades)
            .ConfigureAwait(false);

        return (
            new TrackedWorkItemCanceled { Actor = actor, Reason = command.Reason },
            cascades
        );
    }

    static void EnsureExpected(TrackedWorkItemView.Model view, JsonObject? expected)
    {
        if (expected is null || expected.Count == 0)
        {
            return;
        }

        var expectedStatus = expected["status"]?.GetValue<string>();
        if (
            expectedStatus is not null
            && !string.Equals(
                TrackedWorkItemStatuses.Normalize(expectedStatus),
                TrackedWorkItemStatuses.Normalize(view.Status),
                StringComparison.Ordinal
            )
        )
        {
            throw new CommandValidationException(
                $"Tracked work item no longer matches the expected state (expected status '{expectedStatus}', actual '{view.Status}')."
            );
        }
    }
}
