using Bifrost.Rpc;

namespace Bifrost.MessageBus;

/// <summary>Plane-side <see cref="IBifrostBus"/> that talks to the provider over RPC.</summary>
sealed class RpcBifrostBus(IRpc<IBusTransport> transport) : IBifrostBus
{
    public async Task<TResponse> Request<TRequest, TResponse>(
        TRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var reply = await transport
            .Object.Send(
                new BusMessage
                {
                    MessageType = BusJson.MessageTypeOf(typeof(TRequest)),
                    Payload = BusJson.Serialize(request),
                    CorrelationId = Guid.NewGuid().ToString("N"),
                },
                cancellationToken
            )
            .ConfigureAwait(false);

        if (reply.Error is not null)
        {
            throw new BusException(reply.Error);
        }

        if (reply.Payload is null)
        {
            if (typeof(TResponse) == typeof(Unit) || typeof(TResponse) == typeof(object))
            {
                return default!;
            }

            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.Internal,
                    Message = $"Empty reply for '{typeof(TRequest).Name}'.",
                }
            );
        }

        return BusJson.Deserialize<TResponse>(reply.Payload);
    }

    public Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(@event);
        return transport.Object.Publish(
            new BusMessage
            {
                MessageType = BusJson.MessageTypeOf(typeof(TEvent)),
                Payload = BusJson.Serialize(@event),
                CorrelationId = Guid.NewGuid().ToString("N"),
            }
        );
    }
}

/// <summary>Thrown when a <see cref="BusReply"/> carries an error.</summary>
public sealed class BusException(BusError error) : Exception(error.Message)
{
    public BusError Error { get; } = error ?? throw new ArgumentNullException(nameof(error));
}
