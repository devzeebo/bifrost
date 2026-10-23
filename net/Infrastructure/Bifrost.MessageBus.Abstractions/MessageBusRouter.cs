namespace Bifrost.MessageBus;

/// <summary>
/// Registry of inbound request handlers and event subscribers keyed by MessageType.
/// Shared by the RPC-backed plane dispatcher and the in-memory loopback bus.
/// </summary>
public sealed class MessageBusRouter
{
    public void RegisterHandler(string messageType, MessageBusHandler handler)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageType);
        ArgumentNullException.ThrowIfNull(handler);
        _handlers[messageType] = handler;
    }

    public void RegisterSubscriber(string messageType, MessageBusSubscriber subscriber)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(messageType);
        ArgumentNullException.ThrowIfNull(subscriber);
        _subscribers.Add(messageType, subscriber);
    }

    public async Task<BusReply> Handle(BusMessage message, CancellationToken cancellationToken)
    {
        if (!_handlers.TryGetValue(message.MessageType, out var handler))
        {
            return new BusReply
            {
                Error = new BusError
                {
                    Code = BusErrorCodes.NotFound,
                    Message = $"No handler registered for '{message.MessageType}'.",
                },
            };
        }

        try
        {
            return await handler(message, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            return new BusReply
            {
                Error = new BusError { Code = BusErrorCodes.Internal, Message = ex.Message },
            };
        }
    }

    public async Task Deliver(BusMessage message, CancellationToken cancellationToken)
    {
        if (!_subscribers.TryGetValue(message.MessageType, out var list))
        {
            return;
        }

        foreach (var subscriber in list)
        {
            await subscriber(message, cancellationToken).ConfigureAwait(false);
        }
    }

    readonly Dictionary<string, MessageBusHandler> _handlers = new(StringComparer.Ordinal);
    readonly Dictionary<string, List<MessageBusSubscriber>> _subscribers = new(
        StringComparer.Ordinal
    );
}

public delegate Task<BusReply> MessageBusHandler(
    BusMessage message,
    CancellationToken cancellationToken
);

public delegate Task MessageBusSubscriber(BusMessage message, CancellationToken cancellationToken);

static class SubscriberListExtensions
{
    public static void Add(
        this Dictionary<string, List<MessageBusSubscriber>> map,
        string key,
        MessageBusSubscriber subscriber
    )
    {
        if (!map.TryGetValue(key, out var list))
        {
            list = [];
            map[key] = list;
        }

        list.Add(subscriber);
    }
}
