using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Bifrost.MessageBus.RabbitMq;

/// <summary>
/// RabbitMQ client. Events are persistent publishes to <see cref="RabbitMqBusOptions.EventsExchange"/>
/// and sit in each subscriber's durable queue until that sidecar acks. A command sits in
/// <c>bifrost.commands.{container}</c> until one replica replies, or in
/// <c>bifrost.commands.{container}:{node}</c> until that node replies.
/// </summary>
sealed class RabbitMqMessageBusProvider : IMessageBusProvider, IHostedService, IAsyncDisposable
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (_connection is not null)
        {
            return;
        }

        var factory = new ConnectionFactory
        {
            Uri = new Uri(_options.Endpoint),
            AutomaticRecoveryEnabled = false,
            ConsumerDispatchConcurrency = 1,
        };
        _connection = await factory.CreateConnectionAsync(cancellationToken).ConfigureAwait(false);
        _publish = await _connection
            .CreateChannelAsync(
                new CreateChannelOptions(
                    publisherConfirmationsEnabled: true,
                    publisherConfirmationTrackingEnabled: true
                ),
                cancellationToken
            )
            .ConfigureAwait(false);
        _consume = await _connection
            .CreateChannelAsync(cancellationToken: cancellationToken)
            .ConfigureAwait(false);
        await _consume.BasicQosAsync(0, 1, false, cancellationToken).ConfigureAwait(false);

        await DeclareTopology(cancellationToken).ConfigureAwait(false);
        await Consume(cancellationToken).ConfigureAwait(false);

        _logger.LogInformation(
            "RabbitMQ bus client {Address} connected to {Endpoint}",
            _options.Address,
            _options.Endpoint
        );
    }

    public Task StopAsync(CancellationToken cancellationToken) => DisposeAsync().AsTask();

    public async Task<BusReply> Send(
        BusMessage message,
        CancellationToken cancellationToken = default
    )
    {
        var address = message.Address;
        if (string.IsNullOrWhiteSpace(address))
        {
            throw new InvalidOperationException("Bus command has no address.");
        }

        var container = RabbitMqBusOptions.ContainerOf(address);
        if (!_options.Subscribers.Contains(container))
        {
            throw new InvalidOperationException($"Unknown command container '{container}'.");
        }

        var correlationId = message.CorrelationId ?? Guid.NewGuid().ToString("N");
        var pending = new TaskCompletionSource<BusReply>(
            TaskCreationOptions.RunContinuationsAsynchronously
        );
        if (!_pending.TryAdd(correlationId, pending))
        {
            throw new InvalidOperationException($"Duplicate correlation id '{correlationId}'.");
        }

        await using var registration = cancellationToken.Register(() =>
            pending.TrySetCanceled(cancellationToken)
        );

        try
        {
            var replyTo =
                _replyQueue
                ?? throw new InvalidOperationException("RabbitMQ bus client is not connected.");
            var queue = RabbitMqBusOptions.CommandQueue(address);
            var body = JsonSerializer.SerializeToUtf8Bytes(
                message with
                {
                    CorrelationId = correlationId,
                },
                BusJson.Options
            );
            await Publish(
                    exchange: "",
                    routingKey: queue,
                    properties: new BasicProperties
                    {
                        Persistent = true,
                        CorrelationId = correlationId,
                        ReplyTo = replyTo,
                        ContentType = "application/json",
                    },
                    body,
                    cancellationToken,
                    declareQueue: address.Contains(':') ? queue : null
                )
                .ConfigureAwait(false);
            return await pending.Task.ConfigureAwait(false);
        }
        finally
        {
            _pending.TryRemove(correlationId, out _);
        }
    }

    public async Task Publish(BusMessage message, CancellationToken cancellationToken = default)
    {
        var body = JsonSerializer.SerializeToUtf8Bytes(message, BusJson.Options);
        await Publish(
                exchange: RabbitMqBusOptions.EventsExchange,
                routingKey: "",
                properties: new BasicProperties
                {
                    Persistent = true,
                    ContentType = "application/json",
                },
                body,
                cancellationToken
            )
            .ConfigureAwait(false);
    }

    public Task Subscribe(string topic, CancellationToken cancellationToken = default)
    {
        _ = topic;
        return Task.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return;
        }

        try
        {
            if (_connection is not null)
            {
                await _connection.CloseAsync().ConfigureAwait(false);
            }
        }
        catch
        {
            // already closed
        }

        _connection?.Dispose();
        _publishGate.Dispose();
        foreach (var pending in _pending.Values)
        {
            pending.TrySetCanceled();
        }
    }

    async Task DeclareTopology(CancellationToken cancellationToken)
    {
        var publish = Channel(_publish);
        await publish
            .ExchangeDeclareAsync(
                RabbitMqBusOptions.EventsExchange,
                ExchangeType.Fanout,
                durable: true,
                autoDelete: false,
                cancellationToken: cancellationToken
            )
            .ConfigureAwait(false);

        foreach (var address in _options.Subscribers)
        {
            var queue = RabbitMqBusOptions.EventQueue(address);
            await DeclareQueue(publish, queue, cancellationToken).ConfigureAwait(false);
            await publish
                .QueueBindAsync(
                    queue,
                    RabbitMqBusOptions.EventsExchange,
                    routingKey: "",
                    cancellationToken: cancellationToken
                )
                .ConfigureAwait(false);
            await DeclareQueue(publish, RabbitMqBusOptions.CommandQueue(address), cancellationToken)
                .ConfigureAwait(false);
        }

        if (_options.NodeId is not null)
        {
            await DeclareQueue(
                    publish,
                    RabbitMqBusOptions.CommandQueue($"{_options.Address}:{_options.NodeId}"),
                    cancellationToken
                )
                .ConfigureAwait(false);
        }
    }

    async Task Consume(CancellationToken cancellationToken)
    {
        var consume = Channel(_consume);
        var reply = await consume
            .QueueDeclareAsync(
                queue: "",
                durable: false,
                exclusive: true,
                autoDelete: true,
                cancellationToken: cancellationToken
            )
            .ConfigureAwait(false);
        _replyQueue = reply.QueueName;

        await Listen(
                RabbitMqBusOptions.EventQueue(_options.Address),
                autoAck: false,
                OnEvent,
                cancellationToken
            )
            .ConfigureAwait(false);
        await Listen(_replyQueue!, autoAck: true, OnReply, cancellationToken).ConfigureAwait(false);
        await Listen(
                RabbitMqBusOptions.CommandQueue(_options.Address),
                autoAck: false,
                OnCommand,
                cancellationToken
            )
            .ConfigureAwait(false);
        if (_options.NodeId is not null)
        {
            await Listen(
                    RabbitMqBusOptions.CommandQueue($"{_options.Address}:{_options.NodeId}"),
                    autoAck: false,
                    OnCommand,
                    cancellationToken
                )
                .ConfigureAwait(false);
        }

        async Task Listen(
            string queue,
            bool autoAck,
            AsyncEventHandler<BasicDeliverEventArgs> handler,
            CancellationToken token
        )
        {
            var consumer = new AsyncEventingBasicConsumer(consume);
            consumer.ReceivedAsync += handler;
            await consume.BasicConsumeAsync(queue, autoAck, consumer, token).ConfigureAwait(false);
        }
    }

    async Task OnEvent(object sender, BasicDeliverEventArgs delivery)
    {
        try
        {
            var message = JsonSerializer.Deserialize<BusMessage>(
                delivery.Body.Span,
                BusJson.Options
            );
            if (message is not null)
            {
                await _inbound.Deliver(message).ConfigureAwait(false);
            }

            await Channel(_consume)
                .BasicAckAsync(delivery.DeliveryTag, multiple: false)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deliver published bus message");
            try
            {
                await Channel(_consume)
                    .BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: true)
                    .ConfigureAwait(false);
            }
            catch (Exception nack)
            {
                _logger.LogWarning(nack, "Failed to requeue bus message");
            }
        }
    }

    Task OnReply(object sender, BasicDeliverEventArgs delivery)
    {
        var correlationId = delivery.BasicProperties.CorrelationId;
        if (correlationId is null || !_pending.TryRemove(correlationId, out var pending))
        {
            return Task.CompletedTask;
        }

        var reply = JsonSerializer.Deserialize<BusReply>(delivery.Body.Span, BusJson.Options);
        if (reply is null)
        {
            pending.TrySetException(
                new InvalidOperationException("Failed to deserialize BusReply.")
            );
            return Task.CompletedTask;
        }

        pending.TrySetResult(reply);
        return Task.CompletedTask;
    }

    async Task OnCommand(object sender, BasicDeliverEventArgs delivery)
    {
        BusReply reply;
        try
        {
            var message =
                JsonSerializer.Deserialize<BusMessage>(delivery.Body.Span, BusJson.Options)
                ?? throw new InvalidOperationException("null BusMessage");
            reply = await _inbound.Handle(message).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            reply = new BusReply
            {
                Error = new BusError { Code = BusErrorCodes.Internal, Message = ex.Message },
            };
        }

        try
        {
            var replyTo = delivery.BasicProperties.ReplyTo;
            if (!string.IsNullOrEmpty(replyTo))
            {
                var body = JsonSerializer.SerializeToUtf8Bytes(reply, BusJson.Options);
                await Publish(
                        exchange: "",
                        routingKey: replyTo,
                        properties: new BasicProperties
                        {
                            CorrelationId = delivery.BasicProperties.CorrelationId,
                            ContentType = "application/json",
                        },
                        body,
                        CancellationToken.None
                    )
                    .ConfigureAwait(false);
            }

            await Channel(_consume)
                .BasicAckAsync(delivery.DeliveryTag, multiple: false)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reply to bus command");
            try
            {
                await Channel(_consume)
                    .BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: true)
                    .ConfigureAwait(false);
            }
            catch (Exception nack)
            {
                _logger.LogWarning(nack, "Failed to requeue bus command");
            }
        }
    }

    async Task Publish(
        string exchange,
        string routingKey,
        BasicProperties properties,
        byte[] body,
        CancellationToken cancellationToken,
        string? declareQueue = null
    )
    {
        var publish = Channel(_publish);
        await _publishGate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (declareQueue is not null)
            {
                await DeclareQueue(publish, declareQueue, cancellationToken).ConfigureAwait(false);
            }

            await publish
                .BasicPublishAsync(
                    exchange,
                    routingKey,
                    mandatory: false,
                    properties,
                    body,
                    cancellationToken
                )
                .ConfigureAwait(false);
        }
        finally
        {
            _publishGate.Release();
        }
    }

    static Task DeclareQueue(IChannel channel, string queue, CancellationToken cancellationToken) =>
        channel.QueueDeclareAsync(
            queue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            cancellationToken: cancellationToken
        );

    static IChannel Channel(IChannel? channel) =>
        channel ?? throw new InvalidOperationException("RabbitMQ bus client is not connected.");

    readonly RabbitMqBusOptions _options;
    readonly IMessageBusInbound _inbound;
    readonly ILogger<RabbitMqMessageBusProvider> _logger;
    readonly ConcurrentDictionary<string, TaskCompletionSource<BusReply>> _pending = new();
    readonly SemaphoreSlim _publishGate = new(1, 1);

    IConnection? _connection;
    IChannel? _publish;
    IChannel? _consume;
    string? _replyQueue;
    int _disposed;

    public RabbitMqMessageBusProvider(
        RabbitMqBusOptions options,
        IMessageBusInbound inbound,
        ILogger<RabbitMqMessageBusProvider> logger
    )
    {
        _options = options;
        _inbound = inbound;
        _logger = logger;
        ArgumentException.ThrowIfNullOrWhiteSpace(options.Endpoint);
        ArgumentException.ThrowIfNullOrWhiteSpace(options.Address);
        ArgumentNullException.ThrowIfNull(options.Subscribers);
        if (options.NodeId is not null)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(options.NodeId);
        }
    }
}
