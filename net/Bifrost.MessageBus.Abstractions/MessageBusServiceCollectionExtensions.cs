using Bifrost.Rpc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Bifrost.MessageBus;

public static class MessageBusServiceCollectionExtensions
{
    /// <summary>
    /// Registers the plane-side bus over RPC. The deployable must also call
    /// <c>AddRpcHost</c> so an <see cref="IRpcEndpoint"/> is available.
    /// </summary>
    public static IServiceCollection AddMessageBus(this IServiceCollection services)
    {
        ArgumentNullException.ThrowIfNull(services);

        EnsureRouter(services);
        services.AddRpc<IBusTransport>();
        services.AddRpcHandler<IBusDispatch, RouterBusDispatch>();
        services.TryAddSingleton<IBifrostBus, RpcBifrostBus>();
        return services;
    }

    /// <summary>
    /// Registers a typed request handler on the plane. The payload is deserialized to
    /// <typeparamref name="TRequest"/> and the result serialized back into a <see cref="BusReply"/>.
    /// </summary>
    public static IServiceCollection AddMessageBusHandler<TRequest, TResponse>(
        this IServiceCollection services,
        Func<IServiceProvider, TRequest, CancellationToken, Task<TResponse>> handler
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(handler);

        EnsureRouter(services);
        services.AddSingleton<IMessageBusHandlerRegistration>(
            sp => new TypedHandlerRegistration<TRequest, TResponse>(sp, handler)
        );
        return services;
    }

    /// <summary>
    /// Registers a typed request handler that returns no payload (empty reply).
    /// </summary>
    public static IServiceCollection AddMessageBusHandler<TRequest>(
        this IServiceCollection services,
        Func<IServiceProvider, TRequest, CancellationToken, Task> handler
    )
    {
        ArgumentNullException.ThrowIfNull(handler);
        return services.AddMessageBusHandler<TRequest, Unit>(
            async (sp, request, ct) =>
            {
                await handler(sp, request, ct).ConfigureAwait(false);
                return Unit.Value;
            }
        );
    }

    /// <summary>Registers a typed event subscriber on the plane.</summary>
    public static IServiceCollection AddMessageBusSubscriber<TEvent>(
        this IServiceCollection services,
        Func<IServiceProvider, TEvent, CancellationToken, Task> handler
    )
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(handler);

        EnsureRouter(services);
        services.AddSingleton<IMessageBusHandlerRegistration>(
            sp => new TypedSubscriberRegistration<TEvent>(sp, handler)
        );
        return services;
    }

    /// <summary>
    /// Registers a broker provider. The deployable must also call <c>AddRpcPeer</c>.
    /// Wires <see cref="IBusTransport"/> → provider and <see cref="IMessageBusInbound"/> → plane.
    /// </summary>
    public static IServiceCollection AddMessageBusProvider<TProvider>(
        this IServiceCollection services
    )
        where TProvider : class, IMessageBusProvider
    {
        ArgumentNullException.ThrowIfNull(services);

        services.TryAddSingleton<TProvider>();
        services.TryAddSingleton<IMessageBusProvider>(sp => sp.GetRequiredService<TProvider>());
        services.AddRpcHandler<IBusTransport, ProviderTransportAdapter>();
        services.AddRpc<IBusDispatch>();
        services.TryAddSingleton<IMessageBusInbound, RpcMessageBusInbound>();
        return services;
    }

    static void EnsureRouter(IServiceCollection services)
    {
        services.TryAddSingleton(sp =>
        {
            var router = new MessageBusRouter();
            foreach (var registration in sp.GetServices<IMessageBusHandlerRegistration>())
            {
                registration.Apply(router);
            }

            return router;
        });
    }
}

interface IMessageBusHandlerRegistration
{
    void Apply(MessageBusRouter router);
}

sealed class TypedHandlerRegistration<TRequest, TResponse>(
    IServiceProvider services,
    Func<IServiceProvider, TRequest, CancellationToken, Task<TResponse>> handler
) : IMessageBusHandlerRegistration
{
    public void Apply(MessageBusRouter router)
    {
        var messageType = BusJson.MessageTypeOf(typeof(TRequest));
        router.RegisterHandler(
            messageType,
            async (message, ct) =>
            {
                var request = BusJson.Deserialize<TRequest>(message.Payload);
                try
                {
                    var response = await handler(services, request, ct).ConfigureAwait(false);
                    if (typeof(TResponse) == typeof(Unit))
                    {
                        return new BusReply();
                    }

                    return new BusReply { Payload = BusJson.Serialize(response) };
                }
                catch (BusException ex)
                {
                    return new BusReply { Error = ex.Error };
                }
            }
        );
    }
}

sealed class TypedSubscriberRegistration<TEvent>(
    IServiceProvider services,
    Func<IServiceProvider, TEvent, CancellationToken, Task> handler
) : IMessageBusHandlerRegistration
{
    public void Apply(MessageBusRouter router)
    {
        var messageType = BusJson.MessageTypeOf(typeof(TEvent));
        router.RegisterSubscriber(
            messageType,
            async (message, ct) =>
            {
                var @event = BusJson.Deserialize<TEvent>(message.Payload);
                await handler(services, @event, ct).ConfigureAwait(false);
            }
        );
    }
}
