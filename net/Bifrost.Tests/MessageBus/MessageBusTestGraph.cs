using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Bifrost.Rpc;
using Bifrost.MessageBus;
using Bifrost.Tests;

namespace Bifrost.Tests.MessageBus;

/// <summary>
/// Plane (RpcHost) + provider peer (RpcPeer) over a throwaway unix socket — the same shape a
/// plane and its bus sidecar use in deployment.
/// </summary>
sealed class MessageBusTestGraph : IAsyncDisposable
{
    public string SocketPath { get; } =
        Path.Combine(Path.GetTempPath(), $"bifrost-bus-test-{Guid.NewGuid():N}.sock");

    public IServiceProvider PlaneServices =>
        _plane ?? throw new InvalidOperationException("Call ConfigurePlane first.");

    public IServiceProvider ProviderServices =>
        _provider ?? throw new InvalidOperationException("Call ConfigureProvider first.");

    public MessageBusTestGraph ConfigurePlane(Action<IServiceCollection>? configure = null)
    {
        var services = new ServiceCollection();
        services.AddRpcHost(options =>
        {
            options.SocketPath = SocketPath;
            options.LaunchProcesses = false;
            options.WaitForReadyOnStart = false;
            options.Instances = [new RpcInstanceOptions { Id = "bus", Role = RpcRole.Primary }];
        });
        services.AddMessageBus();
        configure?.Invoke(services);
        _plane = services.BuildServiceProvider();
        return this;
    }

    public MessageBusTestGraph ConfigureProvider<TProvider>(
        Action<IServiceCollection>? configure = null
    )
        where TProvider : class, IMessageBusProvider
    {
        var services = new ServiceCollection();
        services.AddRpcPeer(_ => new RpcPeerOptions
        {
            SocketPath = SocketPath,
            InstanceId = "bus",
            Role = "primary",
        });
        services.AddMessageBusProvider<TProvider>();
        configure?.Invoke(services);
        _provider = services.BuildServiceProvider();
        return this;
    }

    public async Task Start()
    {
        await StartHosted(PlaneServices);
        await StartHosted(ProviderServices);
        await WaitUntilConnected();
    }

    public async ValueTask DisposeAsync()
    {
        if (_provider is not null)
        {
            await StopHosted(_provider);
            await _provider.DisposeAsync();
        }

        if (_plane is not null)
        {
            await StopHosted(_plane);
            await _plane.DisposeAsync();
        }

        try
        {
            File.Delete(SocketPath);
        }
        catch { }
    }

    async Task WaitUntilConnected()
    {
        var host = PlaneServices.GetRequiredService<IRpcHost>();
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(5);
        while (DateTime.UtcNow < deadline)
        {
            if (host.Instances.All(i => i.Connected))
            {
                return;
            }

            await Task.Delay(25);
        }

        throw new TimeoutException("Provider did not connect to the plane in time.");
    }

    static async Task StartHosted(IServiceProvider services)
    {
        foreach (var hosted in services.GetServices<IHostedService>())
        {
            await hosted.StartAsync(CancellationToken.None);
        }
    }

    static async Task StopHosted(IServiceProvider services)
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

    ServiceProvider? _plane;
    ServiceProvider? _provider;
}
