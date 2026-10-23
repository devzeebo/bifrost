using Bifrost.Rpc;

namespace Bifrost.MessageBus;

/// <summary>
/// Adapts <see cref="IMessageBusProvider"/> onto <see cref="IBusTransport"/> so the plane's RPC
/// calls land on the provider implementation.
/// </summary>
sealed class ProviderTransportAdapter(IMessageBusProvider provider) : IBusTransport
{
    public Task<BusReply> Send(
        BusMessage message,
        CancellationToken cancellationToken = default
    ) => provider.Send(message, cancellationToken);

    public Task Publish(BusMessage message) => provider.Publish(message, CancellationToken.None);

    public async Task<Unit> Subscribe(
        string topic,
        CancellationToken cancellationToken = default
    )
    {
        await provider.Subscribe(topic, cancellationToken).ConfigureAwait(false);
        return Unit.Value;
    }
}

/// <summary>
/// Provider-side inbound handle that pushes broker traffic into the plane over RPC.
/// </summary>
sealed class RpcMessageBusInbound(IRpc<IBusDispatch> dispatch) : IMessageBusInbound
{
    public Task<BusReply> Handle(
        BusMessage message,
        CancellationToken cancellationToken = default
    ) => dispatch.Object.Handle(message, cancellationToken);

    public Task Deliver(BusMessage message, CancellationToken cancellationToken = default) =>
        dispatch.Object.Deliver(message);
}
