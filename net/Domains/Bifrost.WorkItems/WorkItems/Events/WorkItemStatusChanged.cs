using System.Text.Json.Serialization;

namespace Bifrost.WorkItems.Events;

public sealed record WorkItemStatusChanged
{
    [JsonConstructor]
    internal WorkItemStatusChanged(WorkItemStatus status) => Status = status;

    public WorkItemStatus Status { get; init; }
}
