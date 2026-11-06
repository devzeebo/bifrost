using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class RestoreCapabilityVersionApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required Guid VersionId { get; init; }
    }
}
