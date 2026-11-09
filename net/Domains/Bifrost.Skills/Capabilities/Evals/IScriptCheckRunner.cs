using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Evals;

public sealed record ScriptCheckRequest
{
    public required Guid CheckId { get; init; }
    public required string Statement { get; init; }
    public required string? Script { get; init; }
    public required string Transcript { get; init; }
    public required string Context { get; init; }
}

public sealed record ScriptCheckResult
{
    public required string Status { get; init; }
    public required string Reason { get; init; }
}

public interface IScriptCheckRunner
{
    Task<ScriptCheckResult> Run(ScriptCheckRequest request, CancellationToken ct);
}
