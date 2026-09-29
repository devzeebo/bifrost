namespace Bifrost.WorkerNodes.Events;

public sealed record WorkerNodeHeartbeatRecorded
{
    public required DateTimeOffset At { get; init; }
}
