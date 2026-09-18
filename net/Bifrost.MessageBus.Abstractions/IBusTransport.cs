using Bifrost.Rpc;

namespace Bifrost.MessageBus;

/// <summary>Plane → provider: outbound calls the plane makes through its bus sidecar.</summary>
public interface IBusTransport : IRpcContract
{
    Task<BusReply> Send(BusMessage message, CancellationToken cancellationToken = default);

    Task Publish(BusMessage message);

    Task<Unit> Subscribe(string topic, CancellationToken cancellationToken = default);
}

/// <summary>Provider → plane: inbound traffic the sidecar pushes into the plane.</summary>
public interface IBusDispatch : IRpcContract
{
    Task<BusReply> Handle(BusMessage message, CancellationToken cancellationToken = default);

    Task Deliver(BusMessage message);
}
