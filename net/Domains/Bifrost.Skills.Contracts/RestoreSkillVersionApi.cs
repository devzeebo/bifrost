using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class RestoreSkillVersionApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required Guid VersionId { get; init; }
    }
}
