using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class RetireRelationshipTypeApi
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
    }
}
