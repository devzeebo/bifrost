using Bifrost.Rpc;

namespace Bifrost.MessageBus;

/// <summary>Plane → provider: outbound calls the plane makes through its bus sidecar.</summary>
public interface IBusTransport : IRpcContract
{
    Task<BusReply> Send(BusMessage message, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns <see cref="Unit"/> so the call is a request (not a fire-and-forget
    /// notification) and the plane awaits broker publish completion.
    /// </summary>
    Task<Unit> Publish(BusMessage message);

    Task<Unit> Subscribe(string topic, CancellationToken cancellationToken = default);
}

/// <summary>Provider → plane: inbound traffic the sidecar pushes into the plane.</summary>
public interface IBusDispatch : IRpcContract
{
    Task<BusReply> Handle(BusMessage message, CancellationToken cancellationToken = default);

    /// <summary>Fire-and-forget notification — event fan-in must not block the broker consumer.</summary>
    Task Deliver(BusMessage message);
}
