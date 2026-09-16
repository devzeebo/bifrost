namespace Bifrost.Rpc;

public enum RpcRole
{
    Primary,
    Shadow,
}

public sealed class RpcInstanceOptions
{
    public required string Id { get; init; }
    public RpcRole Role { get; init; } = RpcRole.Shadow;
    public required string Executable { get; init; }
    public string[] Arguments { get; init; } = [];
    public IDictionary<string, string> Environment { get; init; } =
        new Dictionary<string, string>();
    public string? WorkingDirectory { get; init; }
}

public sealed class RpcHostOptions
{
    /// <summary>
    /// Unix domain socket path. When null, a temp path is generated on start.
    /// </summary>
    public string? SocketPath { get; set; }

    public TimeSpan ReadyTimeout { get; set; } = TimeSpan.FromSeconds(10);

    public TimeSpan ShutdownTimeout { get; set; } = TimeSpan.FromSeconds(3);

    /// <summary>
    /// When false, the host only listens and does not launch processes (useful for in-process tests).
    /// </summary>
    public bool LaunchProcesses { get; set; } = true;

    public IList<RpcInstanceOptions> Instances { get; set; } = [];

    public void Validate()
    {
        if (Instances.Count == 0)
        {
            throw new InvalidOperationException("At least one RPC instance is required.");
        }

        var primaries = Instances.Where(i => i.Role == RpcRole.Primary).ToList();
        if (primaries.Count != 1)
        {
            throw new InvalidOperationException(
                "Exactly one RPC instance must have Role = Primary."
            );
        }

        if (Instances.Select(i => i.Id).Distinct(StringComparer.Ordinal).Count() != Instances.Count)
        {
            throw new InvalidOperationException("RPC instance ids must be unique.");
        }

        foreach (var instance in Instances)
        {
            if (string.IsNullOrWhiteSpace(instance.Id))
            {
                throw new InvalidOperationException("RPC instance id is required.");
            }

            if (LaunchProcesses && string.IsNullOrWhiteSpace(instance.Executable))
            {
                throw new InvalidOperationException(
                    $"RPC instance '{instance.Id}' is missing Executable."
                );
            }
        }
    }
}
