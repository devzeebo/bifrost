using System.Text.Json.Nodes;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Events;

namespace Bifrost.TrackedWorkItems.Aggregate;

public class TrackedWorkItem
{
    public Guid Id { get; set; }
    public string Status { get; set; } = TrackedWorkItemStatuses.Pending;
    public Guid? HolderId { get; set; }
    public int HoldCount { get; set; }

    public void Apply(TrackedWorkItemCreated e)
    {
        Id = e.Id;
        Status = TrackedWorkItemStatuses.Normalize(e.Status);
        HolderId = null;
        HoldCount = 0;
    }

    public void Apply(TrackedWorkItemClaimed e)
    {
        Status = TrackedWorkItemStatuses.Claimed;
        HolderId = e.WorkerId;
    }

    public void Apply(TrackedWorkItemStarted _) => Status = TrackedWorkItemStatuses.Running;

    public void Apply(TrackedWorkItemExecuting _)
    {
        Status = TrackedWorkItemStatuses.Executing;
        HolderId = null;
    }

    public void Apply(TrackedWorkItemNeedsAttention _)
    {
        Status = TrackedWorkItemStatuses.NeedsAttention;
        HoldCount++;
    }

    public void Apply(TrackedWorkItemResumed _) => Status = TrackedWorkItemStatuses.Running;

    public void Apply(TrackedWorkItemSucceeded _)
    {
        Status = TrackedWorkItemStatuses.Succeeded;
        HolderId = null;
    }

    public void Apply(TrackedWorkItemFailed _)
    {
        Status = TrackedWorkItemStatuses.Failed;
        HolderId = null;
    }

    public void Apply(TrackedWorkItemReleased _)
    {
        Status = TrackedWorkItemStatuses.Pending;
        HolderId = null;
    }

    public void Apply(TrackedWorkItemCanceled _)
    {
        Status = TrackedWorkItemStatuses.Canceled;
        HolderId = null;
    }

    public void EnsureExpected(JsonObject? expected)
    {
        if (expected is null || expected.Count == 0)
        {
            return;
        }

        var state = new JsonObject { ["status"] = Status };
        if (!state.MatchesPartial(expected))
        {
            var expectedStatus = expected["status"]?.GetValue<string>();
            throw new CommandValidationException(
                expectedStatus is null
                    ? "Tracked work item no longer matches the expected state."
                    : $"Tracked work item no longer matches the expected state (expected status '{expectedStatus}', actual '{Status}')."
            );
        }
    }
}
