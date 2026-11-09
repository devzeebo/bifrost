namespace Bifrost.WorkerNodes;

public sealed class WorkerLivenessOptions
{
    public const string SectionName = "WorkerLiveness";

    /// <summary>How long a worker may stay quiet before it is declared offline.</summary>
    public TimeSpan SilenceThreshold { get; set; } = TimeSpan.FromSeconds(5);

    /// <summary>How often the detector scans for silence.</summary>
    public TimeSpan CheckInterval { get; set; } = TimeSpan.FromSeconds(1);
}
