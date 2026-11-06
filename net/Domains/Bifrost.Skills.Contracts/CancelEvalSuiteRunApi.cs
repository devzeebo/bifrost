using Bifrost.MessageBus;

namespace Bifrost.Skills.Contracts;

[BusAddress("skills")]
public static class CancelEvalSuiteRunApi
{
    public sealed record Command
    {
        public required Guid SuiteRunId { get; init; }
    }

    public sealed record Response
    {
        public required Guid SuiteRunId { get; init; }
        public required string Status { get; init; }
        public required bool CancelRequested { get; init; }
    }
}
