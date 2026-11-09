using System.Text.Json.Nodes;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Projections;
using Bifrost.WorkerNodes.Projections;
using JasperFx.Events;
using Marten;
using Wolverine;

namespace Bifrost.TrackedWorkItems.Dispatch;

public static class ProcessWorkItemDispatchHandler
{
    public static async Task Handle(
        ProcessWorkItemDispatch _,
        IQuerySession session,
        IMessageBus bus
    )
    {
        var workers = await session
            .Query<WorkerNodeView.Model>()
            .Where(w => w.IsOnline && w.IsAvailable)
            .ToListAsync();
        if (workers.Count == 0)
        {
            return;
        }

        var pending = await session
            .Query<TrackedWorkItemView.Model>()
            .Where(i => i.Status == TrackedWorkItemStatuses.Pending)
            .ToListAsync();
        if (pending.Count == 0)
        {
            return;
        }

        var actor = WorkItemLifecycleActors.Orchestrator;
        foreach (var item in pending)
        {
            var worker = PickWorker(workers);
            try
            {
                await bus.InvokeAsync(
                    new ClaimTrackedWorkItemApi.Command
                    {
                        Id = item.Id,
                        WorkerId = worker.Id,
                        Actor = actor,
                        Reason = "dispatch",
                        Expected = new JsonObject
                        {
                            ["status"] = TrackedWorkItemStatuses.Pending,
                        },
                    }
                );
            }
            catch (Exception ex) when (IsClaimRaceLoss(ex))
            {
                // Only swallow when another claim actually took the item.
                var current = await session.LoadAsync<TrackedWorkItemView.Model>(item.Id);
                if (
                    current is null
                    || current.Status == TrackedWorkItemStatuses.Pending
                )
                {
                    throw;
                }
            }
        }
    }

    /// <summary>Single placement decision — any online worker. #68 replaces this later.</summary>
    static WorkerNodeView.Model PickWorker(IReadOnlyList<WorkerNodeView.Model> workers) =>
        workers[Random.Shared.Next(workers.Count)];

    static bool IsClaimRaceLoss(Exception ex) =>
        ex is CommandValidationException or ContractValidationException
        || ex is EventStreamUnexpectedMaxEventIdException
        || ex.InnerException is CommandValidationException or ContractValidationException
        || ex.InnerException is EventStreamUnexpectedMaxEventIdException;
}
