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
            IsOnline = true,
            LastHeartbeatAt = e.At,
        };

    public Model Apply(WorkerNodeHeartbeatRecorded e, Model view) =>
        view with
        {
            LastHeartbeatAt = e.At,
        };

    public Model Apply(WorkerDeclaredOffline _, Model view) =>
        view with
        {
            IsOnline = false,
        };

    public Model Apply(WorkerDeclaredOnline _, Model view) =>
        view with
        {
            IsOnline = true,
        };
}
