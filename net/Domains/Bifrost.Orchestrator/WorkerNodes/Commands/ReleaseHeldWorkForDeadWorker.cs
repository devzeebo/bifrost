using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Aggregate;
using Bifrost.Runs.Events;
using Bifrost.Runs.Projections;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Dispatch;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Services;
using JasperFx.Events;
using Marten;
using Wolverine;

namespace Bifrost.WorkerNodes.Commands;

public static class ReleaseHeldWorkForDeadWorkerHandler
{
    public static async Task<OutgoingMessages?> Handle(
        ReleaseHeldWorkForDeadWorker message,
        IDocumentSession session,
        IBifrostBus bus
    )
    {
        var itemStream = await session.Events.FetchForWriting<TrackedWorkItem>(message.WorkItemId);
        var item = itemStream.Aggregate;
        if (
            item is null
            || item.HolderId != message.WorkerId
            ||             item.Status
                is not (
                    TrackedWorkItemStatuses.Claimed
                    or TrackedWorkItemStatuses.Running
                    or TrackedWorkItemStatuses.NeedsAttention
                )
        )
        {
            // Race: finished, canceled, or released before the verdict landed.
            return null;
        }

        // Filter Outcome in memory — Marten LINQ over nullable enums is unreliable for null.
        var openRun = (await session
            .Query<RunView.Model>()
            .Where(r => r.WorkItemId == message.WorkItemId)
            .ToListAsync())
            .Where(r => r.Outcome is null)
            .OrderByDescending(r => r.Position)
            .FirstOrDefault();

        IEventStream<Run>? runStream = null;
        if (openRun is not null)
        {
            runStream = await session.Events.FetchForWriting<Run>(openRun.Id);
            if (runStream.Aggregate?.Outcome is not null)
            {
                // Report-first race: the attempt already recorded an ending.
                runStream = null;
                openRun = null;
            }
        }

        if (openRun is null || runStream is null)
        {
            // Held with no open run — still release so the item is not stuck.
            return await ReleaseOnly(message.WorkItemId, itemStream, item, bus);
        }

        var actor = WorkItemLifecycleActors.ForSystem();
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.Release
        );

        await MirrorWorkItemStatusHandler.Handle(
            new MirrorWorkItemStatusHandler.Message
            {
                Id = message.WorkItemId,
                Status = next,
                Actor = actor,
                Reason = WorkerDeathCauses.WorkerDeath,
                ExpectedStatus = from,
                RequestKey = MirrorRequestKeys.For(
                    message.WorkItemId,
                    WorkItemLifecycleAction.Release,
                    from
                ),
            },
            bus
        );

        // Pair durability: item release and run abandonment commit together.
        itemStream.AppendMany(
            new TrackedWorkItemReleased
            {
                Actor = actor,
                Reason = WorkerDeathCauses.WorkerDeath,
            }
        );
        runStream.AppendMany(
            new RunAbandoned { Actor = actor, Reason = WorkerDeathCauses.WorkerDeath }
        );

        return
        [
            new ProcessWorkItemDispatch(),
            new DeliverKillHarnessProcesses
            {
                WorkerId = message.WorkerId,
                WorkItemId = message.WorkItemId,
                RunId = openRun.Id,
            },
        ];
    }

    static async Task<OutgoingMessages> ReleaseOnly(
        Guid workItemId,
        IEventStream<TrackedWorkItem> itemStream,
        TrackedWorkItem item,
        IBifrostBus bus
    )
    {
        var actor = WorkItemLifecycleActors.ForSystem();
        var from = item.Status;
        var next = WorkItemLifecycle.Decide(
            DefaultWorkItemLifecycle.Definition,
            from,
            WorkItemLifecycleAction.Release
        );

        await MirrorWorkItemStatusHandler.Handle(
            new MirrorWorkItemStatusHandler.Message
            {
                Id = workItemId,
                Status = next,
                Actor = actor,
                Reason = WorkerDeathCauses.WorkerDeath,
                ExpectedStatus = from,
                RequestKey = MirrorRequestKeys.For(
                    workItemId,
                    WorkItemLifecycleAction.Release,
                    from
                ),
            },
            bus
        );

        itemStream.AppendMany(
            new TrackedWorkItemReleased
            {
                Actor = actor,
                Reason = WorkerDeathCauses.WorkerDeath,
            }
        );

        return [new ProcessWorkItemDispatch()];
    }
}
