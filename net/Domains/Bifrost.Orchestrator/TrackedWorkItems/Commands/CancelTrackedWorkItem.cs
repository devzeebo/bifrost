using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using Bifrost.Workflows.Contracts;
using Bifrost.WorkItems.Contracts;
using Wolverine;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class CancelTrackedWorkItemHandler
{
    public static void Validate(CancelTrackedWorkItemApi.Command command, TrackedWorkItem item)
    {
        item.EnsureExpected(command.Expected);
        WorkItemLifecycle.EnsureLegal(
            DefaultWorkItemLifecycle.Definition,
            item.Status,
            WorkItemLifecycleAction.Cancel
        );
    }

    [WolverinePost("/cancel-tracked-work-item"), EmptyResponse]
    [AggregateHandler]
    public static async Task<(TrackedWorkItemCanceled Canceled, OutgoingMessages Cascades)> Handle(
        CancelTrackedWorkItemApi.Command command,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = WorkItemLifecycleActors.ForRequester(command.Actor);
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.Cancel
        );

        var cascades = new OutgoingMessages();
        if (from == TrackedWorkItemStatuses.Executing)
        {
            await CancelInFlightNodeExecutions(bus, command.Id, actor, cascades)
                .ConfigureAwait(false);
        }

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

    static async Task CancelInFlightNodeExecutions(
        IBifrostBus bus,
        Guid rootWorkItemId,
        string actor,
        OutgoingMessages cascades
    )
    {
        try
        {
            var listed = await bus.Request<ListWorkItemsApi.Query, ListWorkItemsApi.Response>(
                new ListWorkItemsApi.Query
                {
                    Metadata = new JsonObject
                    {
                        [WorkItemInputDefaults.MetadataRootWorkItemIdKey] =
                            rootWorkItemId.ToString("D"),
                    },
                }
            );

            foreach (
                var item in listed.Items.Where(i =>
                    !i.IsDeleted
                    && i.Status
                        is not (
                            TrackedWorkItemStatuses.Succeeded
                            or TrackedWorkItemStatuses.Failed
                            or TrackedWorkItemStatuses.Canceled
                        )
                )
            )
            {
                cascades.Add(
                    new CancelTrackedWorkItemApi.Command
                    {
                        Id = item.Id,
                        Actor = actor,
                        Reason = "attached workflow canceled",
                    }
                );
            }
        }
        catch (BusException)
        {
            // Best-effort: root cancel still proceeds.
        }
    }
}

