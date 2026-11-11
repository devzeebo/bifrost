namespace Bifrost.WorkerNode;

public sealed class DockerHostOptions
{
    public const string SectionName = "Bifrost:Docker";

    /// <summary>
    /// Absolute workspace root on the Docker host. Used for <c>docker run -v</c>.
    /// When empty, the in-container working directory path is used (same-path bind mounts).
    /// </summary>
    public string HostWorkspaceRoot { get; set; } = "";
}
