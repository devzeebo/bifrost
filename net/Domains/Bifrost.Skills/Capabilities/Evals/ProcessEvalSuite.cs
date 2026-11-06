namespace Bifrost.Capabilities.Evals;

/// <summary>Internal Wolverine message: advance one case on a suite run.</summary>
public sealed record ProcessEvalSuite
{
    public required Guid SuiteRunId { get; init; }
}
