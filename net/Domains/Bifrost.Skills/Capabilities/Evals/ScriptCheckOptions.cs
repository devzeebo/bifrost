namespace Bifrost.Capabilities.Evals;

public sealed class ScriptCheckOptions
{
    public const string SectionName = "ScriptChecks";

    /// <summary>Service-wide default ceiling when a check omits <c>TimeoutMs</c>.</summary>
    public int DefaultTimeoutMs { get; set; } = 5000;
}
