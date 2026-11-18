using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.Workflows.Contracts;
using Bifrost.WorkItems.Contracts;

namespace Bifrost.Workflows.Execution;

static class AttachedWorkflowChildren
{
    public static async Task<ListWorkItemsApi.Response> List(IBifrostBus bus, Guid rootWorkItemId)
    {
        try
        {
            return await bus.Request<ListWorkItemsApi.Query, ListWorkItemsApi.Response>(
                new ListWorkItemsApi.Query
                {
                    Metadata = new JsonObject
                    {
                        [WorkItemInputDefaults.MetadataRootWorkItemIdKey] =
                            rootWorkItemId.ToString("D"),
                    },
                }
            );
        }
        catch (BusException ex)
        {
            throw new InvalidOperationException(
                $"Failed listing attached node executions for root {rootWorkItemId}; aborting so retry can re-discover children.",
                ex
            );
        }
    }

    public static async Task CancelNonTerminal(
        IBifrostBus bus,
        Guid rootWorkItemId,
        string actor,
        string reason,
        Guid? exceptWorkItemId = null
    )
    {
        var listed = await List(bus, rootWorkItemId).ConfigureAwait(false);
        foreach (
            var item in listed.Items.Where(i =>
                !i.IsDeleted
                && i.Id != exceptWorkItemId
                && i.Status
                    is not (
                        TrackedWorkItemStatuses.Succeeded
                        or TrackedWorkItemStatuses.Failed
                        or TrackedWorkItemStatuses.Canceled
                    )
            )
        )
        {
            await bus.Request<CancelTrackedWorkItemApi.Command, Unit>(
                    new CancelTrackedWorkItemApi.Command
                    {
                        Id = item.Id,
                        Actor = actor,
                        Reason = reason,
                    }
                )
                .ConfigureAwait(false);
        }
    }
}
