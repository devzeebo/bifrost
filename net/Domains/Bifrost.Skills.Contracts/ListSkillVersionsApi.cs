using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class ListSkillVersionsApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record VersionSummary
    {
        public required Guid VersionId { get; init; }
        public required DateTimeOffset RecordedAt { get; init; }
        public required Guid DerivedAgainstCapabilityVersionId { get; init; }
    }

    public sealed record Response
    {
        public required IReadOnlyList<VersionSummary> Items { get; init; }
    }
}
