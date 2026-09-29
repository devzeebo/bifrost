using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class ListCommandsApi
{
    public sealed record Query;

    public sealed record Response
    {
        public required IReadOnlyList<string> Commands { get; init; }
        public required IReadOnlyList<string> Queries { get; init; }
    }
}
