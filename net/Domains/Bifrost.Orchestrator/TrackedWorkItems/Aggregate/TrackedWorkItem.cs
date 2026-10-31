using System.Text.Json.Nodes;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Events;

namespace Bifrost.TrackedWorkItems.Aggregate;

public class TrackedWorkItem
{
    public Guid Id { get; set; }
    public string Status { get; set; } = TrackedWorkItemStatuses.Pending;

    public void Apply(TrackedWorkItemCreated e)
    {
        Id = e.Id;
        Status = TrackedWorkItemStatuses.Normalize(e.Status);
    }

    public void Apply(TrackedWorkItemClaimed _) => Status = TrackedWorkItemStatuses.Claimed;

    public void Apply(TrackedWorkItemStarted _) => Status = TrackedWorkItemStatuses.Running;

    public void Apply(TrackedWorkItemSucceeded _) => Status = TrackedWorkItemStatuses.Succeeded;

    public void Apply(TrackedWorkItemFailed _) => Status = TrackedWorkItemStatuses.Failed;

    public void Apply(TrackedWorkItemReleased _) => Status = TrackedWorkItemStatuses.Pending;

    public void Apply(TrackedWorkItemCanceled _) => Status = TrackedWorkItemStatuses.Canceled;

    public void EnsureExpected(JsonObject? expected)
    {
        if (expected is null || expected.Count == 0)
        {
            return;
        }

        var state = new JsonObject { ["status"] = Status };
        if (!state.MatchesPartial(expected))
        {
            throw new CommandValidationException(
                "Tracked work item no longer matches the expected state."
            );
        }
    }
}
