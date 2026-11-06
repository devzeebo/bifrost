using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Evals;

/// <summary>
/// Placeholder until sealed script execution (#94). Never invents pass/fail.
/// </summary>
public sealed class UnsettledScriptCheckRunner : IScriptCheckRunner
{
    public Task<ScriptCheckResult> Run(ScriptCheckRequest request, CancellationToken ct) =>
        Task.FromResult(
            new ScriptCheckResult
            {
                Status = EvalCheckVerdictStatuses.Unsettled,
                Reason = "Awaiting sealed script execution",
            }
        );
}
