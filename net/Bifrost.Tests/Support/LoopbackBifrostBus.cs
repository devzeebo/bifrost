using Bifrost.MessageBus;

namespace Bifrost.Tests.Support;

/// <summary>
/// In-process <see cref="IBifrostBus"/> for tests — routes through <see cref="MessageBusRouter"/>
/// with no RPC or broker.
/// </summary>
sealed class LoopbackBifrostBus(MessageBusRouter router) : IBifrostBus
{
    public async Task<TResponse> Request<TRequest, TResponse>(
        TRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var reply = await router
            .Handle(
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
            return default!;
        }

        return BusJson.Deserialize<TResponse>(reply.Payload);
    }

    public Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(@event);
        return router.Deliver(
            new BusMessage
            {
                MessageType = BusJson.MessageTypeOf(typeof(TEvent)),
                Payload = BusJson.Serialize(@event),
                CorrelationId = Guid.NewGuid().ToString("N"),
            },
            cancellationToken
        );
    }
}
