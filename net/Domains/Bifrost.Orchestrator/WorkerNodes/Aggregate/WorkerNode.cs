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
        IsOnline = true;
        LastHeartbeatAt = e.At;
    }

    public void Apply(WorkerNodeHeartbeatRecorded e) => LastHeartbeatAt = e.At;

    public void Apply(WorkerDeclaredOffline _) => IsOnline = false;

    public void Apply(WorkerDeclaredOnline _) => IsOnline = true;
}
