using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NetMQ;
using NetMQ.Sockets;

namespace Bifrost.MessageBus.ZeroMq;

/// <summary>
/// DEALER client of the central broker. Frames:
/// <c>req</c> / correlation id / json <see cref="BusMessage"/>,
/// <c>rep</c> / correlation id / json <see cref="BusReply"/>,
/// <c>pub</c> / json <see cref="BusMessage"/>.
/// </summary>
sealed class ZeroMqMessageBusProvider : IMessageBusProvider, IHostedService, IDisposable
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (_dealer is not null)
        {
            return Task.CompletedTask;
        }

        _dealer = new DealerSocket();
        _dealer.Options.Identity = Encoding.UTF8.GetBytes(_options.Address);
        _dealer.Connect(_options.Endpoint);
        _dealer.ReceiveReady += OnReceive;
        _poller = new NetMQPoller { _dealer };
        _poller.RunAsync();
        // The broker learns this identity from the first frame.
        Announce();
        _logger.LogInformation(
            "ZeroMQ bus client {Address} connected to {Endpoint}",
            _options.Address,
            _options.Endpoint
        );
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        Dispose();
        return Task.CompletedTask;
    }

    public async Task<BusReply> Send(BusMessage message, CancellationToken cancellationToken = default)
    {
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
            var payload = JsonSerializer.Serialize(message, BusJson.Options);
            Send("req", correlationId, payload);
            return await pending.Task.ConfigureAwait(false);
        }
        finally
        {
            _pending.TryRemove(correlationId, out _);
        }
    }

    public Task Publish(BusMessage message, CancellationToken cancellationToken = default)
    {
        Send("pub", JsonSerializer.Serialize(message, BusJson.Options));
        return Task.CompletedTask;
    }

    public Task Subscribe(string topic, CancellationToken cancellationToken = default)
    {
        _ = topic;
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return;
        }

        try
        {
            _poller?.Stop();
        }
        catch
        {
            // already stopped
        }

        _poller?.Dispose();
        _dealer?.Dispose();
    }

    void OnReceive(object? sender, NetMQSocketEventArgs args)
    {
        var message = new NetMQMessage();
        while (_dealer!.TryReceiveMultipartMessage(ref message))
        {
            try
            {
                Dispatch(message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Ignoring malformed bus frame");
            }

            message = new NetMQMessage();
        }
    }

    void Dispatch(NetMQMessage message)
    {
        if (message.FrameCount < 2)
        {
            return;
        }

        var offset = message[0].MessageSize == 0 ? 1 : 0;
        if (message.FrameCount < offset + 2)
        {
            return;
        }

        var type = message[offset].ConvertToString();
        if (type == "rep" && message.FrameCount >= offset + 3)
        {
            CompleteReply(message[offset + 1].ConvertToString(), message[offset + 2].ConvertToString());
        }
        else if (type == "pub" && message.FrameCount >= offset + 2)
        {
            _ = Deliver(message[offset + 1].ConvertToString());
        }
        else if (type == "req" && message.FrameCount >= offset + 3)
        {
            _ = Answer(message[offset + 1].ConvertToString(), message[offset + 2].ConvertToString());
        }
    }

    void CompleteReply(string correlationId, string json)
    {
        if (!_pending.TryRemove(correlationId, out var pending))
        {
            return;
        }

        var reply = JsonSerializer.Deserialize<BusReply>(json, BusJson.Options);
        if (reply is null)
        {
            pending.TrySetException(new InvalidOperationException("Failed to deserialize BusReply."));
            return;
        }

        pending.TrySetResult(reply);
    }

    async Task Deliver(string json)
    {
        try
        {
            var message = JsonSerializer.Deserialize<BusMessage>(json, BusJson.Options);
            if (message is null)
            {
                return;
            }

            await Task.Run(() => _inbound.Deliver(message)).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deliver published bus message");
        }
    }

    async Task Answer(string correlationId, string json)
    {
        BusReply reply;
        try
        {
            var message =
                JsonSerializer.Deserialize<BusMessage>(json, BusJson.Options)
                ?? throw new InvalidOperationException("null BusMessage");
            reply = await Task.Run(() => _inbound.Handle(message)).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            reply = new BusReply
            {
                Error = new BusError { Code = BusErrorCodes.Internal, Message = ex.Message },
            };
        }

        Send("rep", correlationId, JsonSerializer.Serialize(reply, BusJson.Options));
    }

    void Announce()
    {
        var dealer =
            _dealer ?? throw new InvalidOperationException("ZeroMQ bus client is not connected.");
        lock (_sendGate)
        {
            dealer.SendFrame("hello");
        }
    }

    void Send(string type, string second, string? third = null)
    {
        var dealer =
            _dealer ?? throw new InvalidOperationException("ZeroMQ bus client is not connected.");
        lock (_sendGate)
        {
            if (third is null)
            {
                dealer.SendMoreFrame(type).SendFrame(second);
            }
            else
            {
                dealer.SendMoreFrame(type).SendMoreFrame(second).SendFrame(third);
            }
        }
    }

    readonly ZeroMqBusOptions _options;
    readonly IMessageBusInbound _inbound;
    readonly ILogger<ZeroMqMessageBusProvider> _logger;
    readonly ConcurrentDictionary<string, TaskCompletionSource<BusReply>> _pending = new();
    readonly object _sendGate = new();

    DealerSocket? _dealer;
    NetMQPoller? _poller;
    int _disposed;

    public ZeroMqMessageBusProvider(
        ZeroMqBusOptions options,
        IMessageBusInbound inbound,
        ILogger<ZeroMqMessageBusProvider> logger
    )
    {
        _options = options;
        _inbound = inbound;
        _logger = logger;
        ArgumentException.ThrowIfNullOrWhiteSpace(options.Endpoint);
        ArgumentException.ThrowIfNullOrWhiteSpace(options.Address);
    }
}
