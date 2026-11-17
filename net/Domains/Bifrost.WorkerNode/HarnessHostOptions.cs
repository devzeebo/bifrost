namespace Bifrost.WorkerNode;

public sealed class HarnessHostOptions
{
    public const string SectionName = "Bifrost:Harness";

    public string? Executable { get; set; }
    public string[] Arguments { get; set; } = [];
    public Dictionary<string, string> Environment { get; set; } = new(StringComparer.Ordinal);
    public string WorkingDirectory { get; set; } = "workspaces";
    public string Identity { get; set; } = "harness";

    /// <summary>
    /// Wall-clock ceiling for a single node execution. When reached the process is stopped
    /// and the run fails naming the ceiling. Null or zero means no worker-side ceiling.
    /// </summary>
    public TimeSpan? ExecutionTimeout { get; set; } = TimeSpan.FromHours(1);
}
