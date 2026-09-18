using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Bifrost.Tests.Rpc;

/// <summary>
/// A listen-only host container plus in-process peer containers over a throwaway socket, wired
/// through the same <c>AddRpcHost</c>/<c>AddRpcPeer</c> hosted services a real deployment uses.
/// </summary>
sealed class RpcTestGraph : IAsyncDisposable
{
    public string SocketPath { get; } =
        Path.Combine(Path.GetTempPath(), $"bifrost-rpc-test-{Guid.NewGuid():N}.sock");

    public IServiceProvider HostServices =>
        _hostServices ?? throw new InvalidOperationException("Call ConfigureHost first.");

    public IServiceProvider Peer(string instanceId) => _peerServices[instanceId];

    /// <summary>
    /// The first id is the primary. Instances are not launched; call <see cref="AddPeer"/> to
    /// connect them in-process.
    /// </summary>
    public RpcTestGraph ConfigureHost(
        string[] instanceIds,
        Action<IServiceCollection>? configureServices = null
    )
    {
        var services = new ServiceCollection();
        services.AddRpcHost(options =>
        {
            options.SocketPath = SocketPath;
            options.ReadyTimeout = TimeSpan.FromSeconds(10);
            options.LaunchProcesses = false;
            options.Instances =
            [
                .. instanceIds.Select(
                    (id, index) =>
                        new RpcInstanceOptions
                        {
                            Id = id,
                            Role = index == 0 ? RpcRole.Primary : RpcRole.Shadow,
                        }
                ),
            ];
        });
        configureServices?.Invoke(services);
        _hostServices = services.BuildServiceProvider();
        return this;
    }

    public RpcTestGraph AddPeer(
        string instanceId,
        string role,
        Action<IServiceCollection> configureServices
    )
    {
        var services = new ServiceCollection();
        services.AddRpcPeer(_ => new RpcPeerOptions
        {
            SocketPath = SocketPath,
            InstanceId = instanceId,
            Role = role,
        });
        configureServices(services);
        _peerServices[instanceId] = services.BuildServiceProvider();
        return this;
    }

    /// <summary>
    /// The host does not finish starting until every instance has connected, so both sides start
    /// concurrently. Peers retry the dial until the socket is bound.
    /// </summary>
    public async Task<RpcTestGraph> Start()
    {
        await Task.WhenAll([
            StartHostedServices(HostServices),
            .. _peerServices.Values.Select(StartHostedServices),
        ]);
        return this;
    }

    public async ValueTask DisposeAsync()
    {
        if (_hostServices is not null)
        {
            await StopHostedServices(_hostServices);
            await _hostServices.DisposeAsync();
        }

        foreach (var peer in _peerServices.Values)
        {
            await StopHostedServices(peer);
            await peer.DisposeAsync();
        }

        try
        {
            File.Delete(SocketPath);
        }
        catch { }
    }

    static async Task StartHostedServices(IServiceProvider services)
    {
        foreach (var hosted in services.GetServices<IHostedService>())
        {
            await hosted.StartAsync(CancellationToken.None);
        }
    }

    static async Task StopHostedServices(IServiceProvider services)
    {
        foreach (var hosted in services.GetServices<IHostedService>())
        {
            try
            {
                await hosted.StopAsync(CancellationToken.None);
            }
            catch { }
        }
    }

    readonly Dictionary<string, ServiceProvider> _peerServices = new(StringComparer.Ordinal);
    ServiceProvider? _hostServices;
}
