using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Bifrost.Rpc;

public static class RpcServiceCollectionExtensions
{
    /// <summary>
    /// Registers the calling side of <typeparamref name="TContract"/>. <c>IRpc&lt;TContract&gt;</c>
    /// talks to the whole group (fan-out, primary response); <c>IEnumerable&lt;IRpc&lt;TContract&gt;&gt;</c>
    /// yields one handle per connected instance.
    /// </summary>
    public static IServiceCollection AddRpc<TContract>(this IServiceCollection services)
        where TContract : class, IRpcContract
    {
        ArgumentNullException.ThrowIfNull(services);

        services.TryAddSingleton<IRpc<TContract>>(sp => new RpcHandle<TContract>(
            RpcBindings
                .Get<TContract>()
                .CreateProxy(sp.GetRequiredService<IRpcEndpoint>().GroupSession)
        ));

        // Transient so each resolution reflects the instances connected right now. An exact
        // registration wins over the container's auto-composed enumerable.
        services.TryAddTransient<IEnumerable<IRpc<TContract>>>(sp =>
        {
            var binding = RpcBindings.Get<TContract>();
            return sp.GetRequiredService<IRpcEndpoint>()
                .Sessions.Select(session =>
                    (IRpc<TContract>)new RpcHandle<TContract>(binding.CreateProxy(session))
                )
                .ToArray();
        });

        return services;
    }

    /// <summary>
    /// Registers <typeparamref name="TImplementation"/> as the local implementation of
    /// <typeparamref name="TContract"/> and serves inbound calls with it.
    /// </summary>
    public static IServiceCollection AddRpcHandler<TContract, TImplementation>(
        this IServiceCollection services
    )
        where TContract : class, IRpcContract
        where TImplementation : class, TContract
    {
        ArgumentNullException.ThrowIfNull(services);
        services.TryAddSingleton<TContract, TImplementation>();
        return services.AddRpcHandler<TContract>();
    }

    /// <summary>
    /// Serves inbound <typeparamref name="TContract"/> calls with the implementation already
    /// registered in the container.
    /// </summary>
    public static IServiceCollection AddRpcHandler<TContract>(this IServiceCollection services)
        where TContract : class, IRpcContract
    {
        ArgumentNullException.ThrowIfNull(services);
        services.TryAddEnumerable(
            ServiceDescriptor.Singleton<IRpcSubscription, RpcSubscription<TContract>>()
        );
        return services;
    }
}
