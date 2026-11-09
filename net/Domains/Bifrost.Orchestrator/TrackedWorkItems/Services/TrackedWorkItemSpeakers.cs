using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;

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
}
