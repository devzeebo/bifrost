using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Bifrost.Rpc;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers the listening side: a socket the configured instances connect back to, plus the
    /// processes to launch. Pair with <c>AddRpc&lt;T&gt;</c> to call peers and
    /// <c>AddRpcHandler&lt;T&gt;</c> to serve them.
    /// </summary>
    public static IServiceCollection AddRpcHost(
        this IServiceCollection services,
        Action<RpcHostOptions> configure
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configure);

        services.AddOptions<RpcHostOptions>().Configure(configure);
        services.TryAddSingleton(sp => new RpcHost(
            sp.GetRequiredService<IOptions<RpcHostOptions>>(),
            sp.GetService<ILogger<RpcHost>>()
        ));
        services.TryAddSingleton<IRpcHost>(sp => sp.GetRequiredService<RpcHost>());
        services.TryAddSingleton<IRpcEndpoint>(sp => sp.GetRequiredService<RpcHost>());
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IHostedService, RpcHostedService>());
        return services;
    }

    /// <summary>
    /// Registers the connecting side, reading the socket path, instance id, and role the host
    /// passed on the command line or in the environment.
    /// </summary>
    public static IServiceCollection AddRpcPeer(this IServiceCollection services) =>
        services.AddRpcPeer(_ => RpcPeerOptions.FromEnvironment(Environment.GetCommandLineArgs()));

    /// <summary>Registers the connecting side with explicit options.</summary>
    public static IServiceCollection AddRpcPeer(
        this IServiceCollection services,
        Func<IServiceProvider, RpcPeerOptions> configure
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configure);

        services.TryAddSingleton(sp => new RpcPeer(configure(sp)));
        services.TryAddSingleton<IRpcEndpoint>(sp => sp.GetRequiredService<RpcPeer>());
        services.TryAddEnumerable(
            ServiceDescriptor.Singleton<IHostedService, RpcPeerHostedService>()
        );
        return services;
    }
}

// IHostedService names these; implemented explicitly so the suffix stays Microsoft's and does
// not become part of our own surface.
internal sealed class RpcHostedService : IHostedService
{
    Task IHostedService.StartAsync(CancellationToken cancellationToken)
    {
        foreach (var subscription in _subscriptions)
        {
            _host.AddSubscriber(subscription.Apply);
        }

        return _host.Start(cancellationToken);
    }

    Task IHostedService.StopAsync(CancellationToken cancellationToken) =>
        _host.Stop(cancellationToken);

    readonly RpcHost _host;
    readonly IRpcSubscription[] _subscriptions;

    public RpcHostedService(RpcHost host, IEnumerable<IRpcSubscription> subscriptions)
    {
        _host = host;
        _subscriptions = [.. subscriptions];
    }
}

internal sealed class RpcPeerHostedService : IHostedService
{
    Task IHostedService.StartAsync(CancellationToken cancellationToken)
    {
        foreach (var subscription in _subscriptions)
        {
            _peer.AddSubscriber(subscription.Apply);
        }

        var lifetime = _services.GetService<IHostApplicationLifetime>();
        if (lifetime is not null)
        {
            _peer.ShutdownRequested += lifetime.StopApplication;
        }

        return _peer.Connect(cancellationToken);
    }

    Task IHostedService.StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    readonly RpcPeer _peer;
    readonly IServiceProvider _services;
    readonly IRpcSubscription[] _subscriptions;

    public RpcPeerHostedService(
        RpcPeer peer,
        IServiceProvider services,
        IEnumerable<IRpcSubscription> subscriptions
    )
    {
        _peer = peer;
        _services = services;
        _subscriptions = [.. subscriptions];
    }
}
