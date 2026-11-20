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
        List<Exception>? failures = null;
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
            try
            {
                if (await IsTerminal(bus, item.Id).ConfigureAwait(false))
                {
                    continue;
                }

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
            catch (Exception ex)
            {
                if (await IsTerminal(bus, item.Id).ConfigureAwait(false))
                {
                    // Nested advance may have canceled this sibling already.
                    continue;
                }

                failures ??= [];
                failures.Add(
                    new InvalidOperationException(
                        $"Failed canceling attached node execution {item.Id}.",
                        ex
                    )
                );
            }
        }

        if (failures is { Count: > 0 })
        {
            throw new AggregateException(
                $"Failed canceling {failures.Count} attached node execution(s) for root {rootWorkItemId}.",
                failures
            );
        }
    }

    static async Task<bool> IsTerminal(IBifrostBus bus, Guid workItemId)
    {
        try
        {
            var tracked = await bus.Request<
                GetTrackedWorkItemApi.Query,
                GetTrackedWorkItemApi.Response
            >(new GetTrackedWorkItemApi.Query { Id = workItemId });
            return tracked.Status
                is TrackedWorkItemStatuses.Succeeded
                    or TrackedWorkItemStatuses.Failed
                    or TrackedWorkItemStatuses.Canceled;
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.NotFound)
        {
            return false;
        }
    }
}
