using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class DuplicateCapabilityEvalApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required Guid SourceEvalId { get; init; }
        public required Guid NewEvalId { get; init; }
    }
}
