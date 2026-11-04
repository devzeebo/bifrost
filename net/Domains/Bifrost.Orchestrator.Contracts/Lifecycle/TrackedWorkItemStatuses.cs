namespace Bifrost.Orchestrator.Contracts;

/// <summary>
/// Item lifecycle statuses owned by the orchestrator.
/// <c>abandoned</c> is a run outcome only — never an item status.
/// </summary>
public static class TrackedWorkItemStatuses
{
    public const string Pending = "pending";
    public const string Claimed = "claimed";
    public const string Running = "running";
    public const string Succeeded = "succeeded";
    public const string Failed = "failed";
    public const string Canceled = "canceled";

    public static string Normalize(string status) => status.Trim().ToLowerInvariant();
}
