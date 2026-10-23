namespace Bifrost.MessageBus;

/// <summary>
/// Broker binding implemented by a sidecar binary (ZeroMQ, Azure Service Bus, …).
/// The sidecar never deserializes domain types — payloads stay as <see cref="BusMessage"/>.
/// </summary>
public interface IMessageBusProvider
{
    Task<BusReply> Send(BusMessage message, CancellationToken cancellationToken = default);

    Task Publish(BusMessage message, CancellationToken cancellationToken = default);

    Task Subscribe(string topic, CancellationToken cancellationToken = default);
}

/// <summary>
/// Injected into a provider: the way broker traffic gets pushed into the plane over RPC.
/// </summary>
public interface IMessageBusInbound
{
    Task<BusReply> Handle(BusMessage message, CancellationToken cancellationToken = default);

    Task Deliver(BusMessage message, CancellationToken cancellationToken = default);
}
