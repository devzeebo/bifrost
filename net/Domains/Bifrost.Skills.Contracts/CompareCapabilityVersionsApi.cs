using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class CompareCapabilityVersionsApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
        public required Guid LeftVersionId { get; init; }
        public required Guid RightVersionId { get; init; }
    }

    public sealed record Response
    {
        public required GetCapabilityVersionApi.Response Left { get; init; }
        public required GetCapabilityVersionApi.Response Right { get; init; }
    }
}
