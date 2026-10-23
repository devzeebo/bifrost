using Bifrost.WorkerNodes.Events;

namespace Bifrost.WorkerNodes.Aggregate;

public class WorkerNode
{
    public Guid Id { get; set; }
    public bool IsAvailable { get; set; }
    public bool IsOnline { get; set; }
    public DateTimeOffset? LastHeartbeatAt { get; set; }

    public void Apply(WorkerNodeRegistered e)
    {
        Id = e.Id;
        IsAvailable = true;
    }

    public void Apply(WorkerNodeHeartbeatRecorded e)
    {
        IsOnline = true;
        LastHeartbeatAt = e.At;
    }
}
