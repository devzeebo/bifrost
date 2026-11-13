using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Commands;
using Bifrost.TrackedWorkItems.Projections;
using Bifrost.Workflows.Contracts;
using Bifrost.WorkItems.Contracts;
using Marten;
using Wolverine;

namespace Bifrost.TrackedWorkItems.Workflow;

/// <summary>
/// Lists children then cancels them and the root. Runs on the same sequential local queue as
/// <see cref="AdvanceWorkflowExecution"/> so DraftAndScheduleNode cannot interleave with listing.
/// </summary>
public static class CancelAttachedWorkflowRootHandler
{
    public static async Task Handle(
        CancelAttachedWorkflowRoot message,
        IQuerySession session,
        IBifrostBus bus,
        IMessageBus local
    )
    {
        var root = await session.LoadAsync<TrackedWorkItemView.Model>(message.RootWorkItemId);
        if (root is null)
        {
            return;
        }

        if (root.Status != TrackedWorkItemStatuses.Executing)
        {
            return;
        }

        ListWorkItemsApi.Response listed;
        try
        {
            listed = await bus.Request<ListWorkItemsApi.Query, ListWorkItemsApi.Response>(
                new ListWorkItemsApi.Query
                {
                    Metadata = new JsonObject
                    {
                        [WorkItemInputDefaults.MetadataRootWorkItemIdKey] =
                            message.RootWorkItemId.ToString("D"),
                    },
                }
            );
        }
        catch (BusException ex)
        {
            throw new InvalidOperationException(
                $"Failed listing attached node executions for root {message.RootWorkItemId}; aborting cancel so retry can re-discover children.",
                ex
            );
        }

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
            await local
                .InvokeAsync(
                    new ApplyCancelTrackedWorkItem
                    {
                        Id = item.Id,
                        Actor = message.Actor,
                        Reason = "attached workflow canceled",
                    }
                )
                .ConfigureAwait(false);
        }

        await local
            .InvokeAsync(
                new ApplyCancelTrackedWorkItem
                {
                    Id = message.RootWorkItemId,
                    Actor = message.Actor,
                    Reason = message.Reason,
                    Expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Executing },
                }
            )
            .ConfigureAwait(false);
    }
}
