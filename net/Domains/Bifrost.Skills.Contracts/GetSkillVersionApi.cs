using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class GetSkillVersionApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
        public required Guid VersionId { get; init; }
    }

    public sealed record Response
    {
        public required Guid VersionId { get; init; }
        public required Guid CapabilityId { get; init; }
        public required DateTimeOffset RecordedAt { get; init; }
        public required SkillVersionSnapshot Snapshot { get; init; }
    }
}
