namespace Bifrost.WorkerNode;

public sealed class HarnessHostOptions
{
    public const string SectionName = "Bifrost:Harness";

    public string? Executable { get; set; }
    public string[] Arguments { get; set; } = [];
    public Dictionary<string, string> Environment { get; set; } = new(StringComparer.Ordinal);
    public string WorkingDirectory { get; set; } = "workspaces";
    public string Identity { get; set; } = "harness";
}
