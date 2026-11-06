using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class SaveDerivedSkillApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required string Markdown { get; init; }
    }
}
