using Bifrost.Capabilities.Events;
using Marten.Events.Projections;

namespace Bifrost.Capabilities.Projections;

public class CapabilityVersionView : MultiStreamProjection<CapabilityVersionView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public Guid CapabilityId { get; init; }
        public DateTimeOffset RecordedAt { get; init; }
        public required CapabilityVersionSnapshot Snapshot { get; init; }
    }

    public CapabilityVersionView()
    {
        Name = nameof(CapabilityVersionView);
        Identity<CapabilityVersionRecorded>(e => e.VersionId);
    }

    public Model Create(CapabilityVersionRecorded e) =>
        new()
        {
            Id = e.VersionId,
            CapabilityId = e.CapabilityId,
            RecordedAt = e.RecordedAt,
            Snapshot = e.Snapshot,
        };
}
