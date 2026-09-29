using System.Text.Json.Serialization;

namespace Bifrost.WorkItems.Events;

public sealed record WorkItemDeleted
{
    [JsonConstructor]
    internal WorkItemDeleted() { }
}
