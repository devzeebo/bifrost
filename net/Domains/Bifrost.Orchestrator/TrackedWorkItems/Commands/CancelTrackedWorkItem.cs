using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Projections;
using Bifrost.TrackedWorkItems.Services;
using Bifrost.Workflows.Contracts;
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
        IMessageBus bus,
        IBifrostBus bifrostBus
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
            try
            {
                await bifrostBus
                    .Request<CancelAttachedWorkflowRootApi.Command, Unit>(
                        new CancelAttachedWorkflowRootApi.Command
                        {
                            RootWorkItemId = command.Id,
                            Actor = actor,
                            Reason = command.Reason,
                        }
                    )
                    .ConfigureAwait(false);
            }
            catch (BusException ex)
            {
                throw new CommandValidationException(
                    $"Cannot cancel executing work item {command.Id} through attached workflow cancel: {ex.Error.Message}"
                );
            }

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

    [WolverinePost("/apply-cancel-tracked-work-item"), EmptyResponse]
    public static async Task Handle(
        ApplyCancelTrackedWorkItemApi.Command command,
        IMessageBus bus
    )
    {
        var actor = WorkItemLifecycleActors.ForRequester(command.Actor);
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

        return (
            new TrackedWorkItemCanceled { Actor = actor, Reason = command.Reason },
            [
                new TrackedWorkItemTerminal
                {
                    WorkItemId = command.Id,
                    Status = next,
                    Reason = command.Reason,
                },
            ]
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
