using Bifrost.WorkerNodes.Events;
using Marten.Events.Aggregation;

namespace Bifrost.WorkerNodes.Projections;

public class WorkerNodeView : SingleStreamProjection<WorkerNodeView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public bool IsAvailable { get; init; }
        public bool IsOnline { get; init; }
        public DateTimeOffset? LastHeartbeatAt { get; init; }
    }

    public Model Create(WorkerNodeRegistered e) =>
        new()
        {
            Id = e.Id,
            IsAvailable = true,
        };

    public Model Apply(WorkerNodeHeartbeatRecorded e, Model view) =>
        view with
        {
            IsOnline = true,
            LastHeartbeatAt = e.At,
        };
}
