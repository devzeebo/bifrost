namespace Bifrost.Rpc;

/// <summary>Connection state of one configured instance.</summary>
public sealed record RpcInstanceStatus(string Id, RpcRole Role, bool Connected);

/// <summary>
/// Lifecycle and diagnostics for the listening side. Calls go through <c>IRpc&lt;T&gt;</c>;
/// <see cref="IRpcEndpoint"/> is the escape hatch to the raw sessions.
/// </summary>
public interface IRpcHost : IAsyncDisposable
{
    string SocketPath { get; }

    bool IsRunning { get; }

    IReadOnlyList<RpcInstanceStatus> Instances { get; }

    Task Start(CancellationToken cancellationToken = default);

    Task Stop(CancellationToken cancellationToken = default);
}
