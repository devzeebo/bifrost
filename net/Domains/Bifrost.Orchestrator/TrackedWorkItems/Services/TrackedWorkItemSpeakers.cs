using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Projections;
using Bifrost.TrackedWorkItems.Aggregate;
using Marten;

namespace Bifrost.TrackedWorkItems.Services;

public static class TrackedWorkItemSpeakers
{
    public static void EnsureHolder(TrackedWorkItem item, string actor)
    {
        if (
            !WorkItemLifecycleActors.TryParseWorker(actor, out var workerId)
            || item.HolderId != workerId
        )
        {
            throw new CommandValidationException(
                "Only the worker holding this work item may report this transition."
            );
        }
    }

    public static void EnsureHolderOrSystem(TrackedWorkItem item, string actor)
    {
        if (actor == WorkItemLifecycleActors.Orchestrator)
        {
            return;
        }

        EnsureHolder(item, actor);
    }

    public static void EnsureRunId(Guid runId)
    {
        if (runId == Guid.Empty)
        {
            throw new CommandValidationException("RunId is required.");
        }
    }

    public static async Task EnsureRunForItem(
        Guid runId,
        Guid workItemId,
        IQuerySession session,
        bool requireOpen
    )
    {
        EnsureRunId(runId);

        var run =
            await session.LoadAsync<RunView.Model>(runId)
            ?? throw new CommandValidationException($"Run {runId} not found.");

        if (run.WorkItemId != workItemId)
        {
            throw new CommandValidationException("Run does not belong to this work item.");
        }

        if (run.Outcome is RunOutcome.Abandoned)
        {
            throw new CommandValidationException(
                "Run was abandoned and can no longer be reported."
            );
        }

        if (requireOpen && run.Outcome is not null)
        {
            throw new CommandValidationException("Run already has an outcome.");
        }
    }
}
