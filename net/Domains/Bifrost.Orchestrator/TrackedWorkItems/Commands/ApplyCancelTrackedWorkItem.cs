using System.Text.Json.Nodes;

namespace Bifrost.TrackedWorkItems.Commands;

/// <summary>
/// Internal aggregate apply for cancel. HTTP and <c>CancelAttachedWorkflowRoot</c> route here
/// after any attached-root child discovery is finished.
/// </summary>
public sealed record ApplyCancelTrackedWorkItem
{
    public required Guid Id { get; init; }
    public required string Actor { get; init; }
    public required string Reason { get; init; }
    public JsonObject? Expected { get; init; }
}
