using Bifrost.Capabilities.Events;
using Marten.Events.Projections;

namespace Bifrost.Capabilities.Projections;

public class SkillVersionView : MultiStreamProjection<SkillVersionView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public Guid CapabilityId { get; init; }
        public DateTimeOffset RecordedAt { get; init; }
        public required SkillVersionSnapshot Snapshot { get; init; }
    }

    public SkillVersionView()
    {
        Name = nameof(SkillVersionView);
        Identity<SkillVersionRecorded>(e => e.VersionId);
    }

    public Model Create(SkillVersionRecorded e) =>
        new()
        {
            Id = e.VersionId,
            CapabilityId = e.CapabilityId,
            RecordedAt = e.RecordedAt,
            Snapshot = e.Snapshot,
        };
}
