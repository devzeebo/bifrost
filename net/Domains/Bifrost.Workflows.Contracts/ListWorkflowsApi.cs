using Bifrost.MessageBus;

namespace Bifrost.Workflows.Contracts;

[BusAddress("workflows")]
public static class ListWorkflowsApi
{
    public sealed record Query;

    public sealed record Response
    {
        public sealed record Item
        {
            public required Guid Id { get; init; }
            public required string Name { get; init; }
        }

        public required IReadOnlyList<Item> Items { get; init; }
    }
}
