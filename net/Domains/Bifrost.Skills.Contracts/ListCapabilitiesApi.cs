using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class ListCapabilitiesApi
{
    public sealed record Query;

    public sealed record Response
    {
        public sealed record Item
        {
            public required Guid Id { get; init; }
            public required string Name { get; init; }
            public bool HasPublishedSkill { get; init; }
        }

        public required IReadOnlyList<Item> Items { get; init; }
    }
}
