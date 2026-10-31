using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Events;
using Marten.Events.Aggregation;

namespace Bifrost.TrackedWorkItems.Projections;

public class TrackedWorkItemView : SingleStreamProjection<TrackedWorkItemView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required string Status { get; init; }
    }

    public Model Create(TrackedWorkItemCreated e) =>
        new()
        {
            Id = e.Id,
            Status = TrackedWorkItemStatuses.Normalize(e.Status),
        };

    public Model Apply(TrackedWorkItemClaimed _, Model view) =>
        view with
        {
            Status = TrackedWorkItemStatuses.Claimed,
        };

    public Model Apply(TrackedWorkItemStarted _, Model view) =>
        view with
        {
            Status = TrackedWorkItemStatuses.Running,
        };

    public Model Apply(TrackedWorkItemSucceeded _, Model view) =>
        view with
        {
            Status = TrackedWorkItemStatuses.Succeeded,
        };

    public Model Apply(TrackedWorkItemFailed _, Model view) =>
        view with
        {
            Status = TrackedWorkItemStatuses.Failed,
        };

    public Model Apply(TrackedWorkItemReleased _, Model view) =>
        view with
        {
            Status = TrackedWorkItemStatuses.Pending,
        };

    public Model Apply(TrackedWorkItemCanceled _, Model view) =>
        view with
        {
            Status = TrackedWorkItemStatuses.Canceled,
        };
}
