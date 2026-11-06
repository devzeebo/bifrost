using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class CompareSkillVersionsApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
        public required Guid LeftVersionId { get; init; }
        public required Guid RightVersionId { get; init; }
    }

    public sealed record Response
    {
        public required GetSkillVersionApi.Response Left { get; init; }
        public required GetSkillVersionApi.Response Right { get; init; }
    }
}
