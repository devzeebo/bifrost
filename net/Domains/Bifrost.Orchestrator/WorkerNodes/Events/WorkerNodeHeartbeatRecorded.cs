using System.Text.Json.Serialization;

namespace Bifrost.WorkerNodes.Events;

public sealed record WorkerNodeHeartbeatRecorded
{
    [JsonConstructor]
    internal WorkerNodeHeartbeatRecorded(DateTimeOffset at) => At = at;

    public DateTimeOffset At { get; init; }
}
