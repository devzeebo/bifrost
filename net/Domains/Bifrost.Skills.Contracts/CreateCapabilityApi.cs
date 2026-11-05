using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class CreateCapabilityApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required string Name { get; init; }
        public required string Ask { get; init; }
    }
}
