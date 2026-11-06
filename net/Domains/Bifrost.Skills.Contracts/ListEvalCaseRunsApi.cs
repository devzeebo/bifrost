using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class ListEvalCaseRunsApi
{
    public sealed record Query
    {
        public required Guid CapabilityId { get; init; }
        public required Guid EvalId { get; init; }
    }

    public sealed record Response
    {
        public required IReadOnlyList<EvalCaseRunSummary> Items { get; init; }
    }
}
