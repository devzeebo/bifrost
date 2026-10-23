using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class GetRelationshipTypeApi
{
    public sealed record Query
    {
        public required Guid Id { get; init; }
    }

    public sealed record Response
    {
        public required Guid Id { get; init; }
        public required string ForwardWord { get; init; }
        public required string InverseWord { get; init; }
        public bool IsActive { get; init; }
    }
}
