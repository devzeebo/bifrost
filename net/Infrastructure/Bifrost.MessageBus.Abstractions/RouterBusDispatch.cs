namespace Bifrost.MessageBus;

/// <summary>Plane-side <see cref="IBusDispatch"/> that routes through <see cref="MessageBusRouter"/>.</summary>
sealed class RouterBusDispatch(MessageBusRouter router) : IBusDispatch
{
    public Task<BusReply> Handle(
        BusMessage message,
        CancellationToken cancellationToken = default
    ) => router.Handle(message, cancellationToken);

    public Task Deliver(BusMessage message) =>
        router.Deliver(message, CancellationToken.None);
}
