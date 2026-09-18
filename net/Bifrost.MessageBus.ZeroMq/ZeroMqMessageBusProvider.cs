using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NetMQ;
using NetMQ.Sockets;

namespace Bifrost.MessageBus.ZeroMq;

/// <summary>
/// ZeroMQ-backed <see cref="IMessageBusProvider"/>. Server mode binds a ROUTER; client mode
/// connects a DEALER. Frames:
/// <list type="bullet">
///   <item><c>req</c> / <c>corrId</c> / json <see cref="BusMessage"/> — request/reply</item>
///   <item><c>rep</c> / <c>corrId</c> / json <see cref="BusReply"/></item>
///   <item><c>pub</c> / json <see cref="BusMessage"/> — fire-and-forget event</item>
/// </list>
/// </summary>
sealed class ZeroMqMessageBusProvider : IMessageBusProvider, IHostedService, IDisposable
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (_mode == BusMode.Server)
        {
            _router = new RouterSocket();
            _router.Bind(_options.RouterEndpoint);
            _router.ReceiveReady += OnRouterReceiveReady;
            _poller = new NetMQPoller { _router };
        }
        else
        {
            _dealer = new DealerSocket();
            _dealer.Options.Identity = Encoding.UTF8.GetBytes(
                Environment.GetEnvironmentVariable("BIFROST_INSTANCE_ID") ?? Guid.NewGuid().ToString("N")
            );
            _dealer.Connect(_options.RouterEndpoint);
            _dealer.ReceiveReady += OnDealerReceiveReady;
            _poller = new NetMQPoller { _dealer };
        }

        _poller.RunAsync();
        _logger.LogInformation(
            "ZeroMQ bus {Mode} listening on {Endpoint}",
            _mode,
            _options.RouterEndpoint
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
        if (_mode == BusMode.Server)
        {
            // Server-side Send means deliver into the local plane (we are the data plane's sidecar).
            return await _inbound.Handle(message, cancellationToken).ConfigureAwait(false);
        }

        var corr = message.CorrelationId ?? Guid.NewGuid().ToString("N");
        var tcs = new TaskCompletionSource<BusReply>(
            TaskCreationOptions.RunContinuationsAsynchronously
        );
        if (!_pending.TryAdd(corr, tcs))
        {
            throw new InvalidOperationException($"Duplicate correlation id '{corr}'.");
        }

        await using var reg = cancellationToken.Register(() => tcs.TrySetCanceled(cancellationToken));

        try
        {
            var payload = JsonSerializer.Serialize(message, BusJson.Options);
            _dealer!.SendMoreFrame("req").SendMoreFrame(corr).SendFrame(payload);
            return await tcs.Task.ConfigureAwait(false);
        }
        finally
        {
            _pending.TryRemove(corr, out _);
        }
    }

    public Task Publish(BusMessage message, CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(message, BusJson.Options);

        if (_mode == BusMode.Client)
        {
            _dealer!.SendMoreFrame("pub").SendFrame(payload);
            return Task.CompletedTask;
        }

        // Server: fan out to every known dealer. The publishing plane already has the event.
        BroadcastPub(payload);
        return Task.CompletedTask;
    }

    public Task Subscribe(string topic, CancellationToken cancellationToken = default)
    {
        // Topic filtering is by MessageType at the plane; ZMQ carries every pub.
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
        catch { }

        _poller?.Dispose();
        _router?.Dispose();
        _dealer?.Dispose();
    }

    void OnRouterReceiveReady(object? sender, NetMQSocketEventArgs e)
    {
        while (_router!.TryReceiveMultipartMessage(ref _routerMsg!))
        {
            if (_routerMsg.FrameCount < 3)
            {
                continue;
            }

            var identity = _routerMsg[0].ToByteArray();
            _knownClients.TryAdd(Convert.ToHexString(identity), identity);

            // [identity][empty?][type]... — DEALER may or may not include empty delimiter.
            var offset = _routerMsg[1].MessageSize == 0 ? 2 : 1;
            if (_routerMsg.FrameCount < offset + 2)
            {
                continue;
            }

            var type = _routerMsg[offset].ConvertToString();
            if (type == "req" && _routerMsg.FrameCount >= offset + 3)
            {
                var corr = _routerMsg[offset + 1].ConvertToString();
                var json = _routerMsg[offset + 2].ConvertToString();
                _ = HandleIncomingRequest(identity, corr, json);
            }
            else if (type == "pub")
            {
                var json = _routerMsg[offset + 1].ConvertToString();
                _ = HandleIncomingPub(json, identity);
            }

            _routerMsg = new NetMQMessage();
        }
    }

    void OnDealerReceiveReady(object? sender, NetMQSocketEventArgs e)
    {
        while (_dealer!.TryReceiveMultipartMessage(ref _dealerMsg!))
        {
            if (_dealerMsg.FrameCount < 2)
            {
                continue;
            }

            var offset = _dealerMsg[0].MessageSize == 0 ? 1 : 0;
            if (_dealerMsg.FrameCount < offset + 2)
            {
                continue;
            }

            var type = _dealerMsg[offset].ConvertToString();
            if (type == "rep" && _dealerMsg.FrameCount >= offset + 3)
            {
                var corr = _dealerMsg[offset + 1].ConvertToString();
                var json = _dealerMsg[offset + 2].ConvertToString();
                if (_pending.TryRemove(corr, out var tcs))
                {
                    var reply = JsonSerializer.Deserialize<BusReply>(json, BusJson.Options);
                    if (reply is not null)
                    {
                        tcs.TrySetResult(reply);
                    }
                    else
                    {
                        tcs.TrySetException(
                            new InvalidOperationException("Failed to deserialize BusReply.")
                        );
                    }
                }
            }
            else if (type == "pub")
            {
                var json = _dealerMsg[offset + 1].ConvertToString();
                _ = HandleIncomingPub(json, senderIdentity: null);
            }

            _dealerMsg = new NetMQMessage();
        }
    }

    async Task HandleIncomingRequest(byte[] identity, string corr, string json)
    {
        BusReply reply;
        try
        {
            var message =
                JsonSerializer.Deserialize<BusMessage>(json, BusJson.Options)
                ?? throw new InvalidOperationException("null BusMessage");
            // Leave the NetMQ poller thread before calling back into the plane over RPC.
            reply = await Task.Run(() => _inbound.Handle(message)).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            reply = new BusReply
            {
                Error = new BusError { Code = BusErrorCodes.Internal, Message = ex.Message },
            };
        }

        var replyJson = JsonSerializer.Serialize(reply, BusJson.Options);
        lock (_sendGate)
        {
            _router!
                .SendMoreFrame(identity)
                .SendMoreFrameEmpty()
                .SendMoreFrame("rep")
                .SendMoreFrame(corr)
                .SendFrame(replyJson);
        }
    }

    async Task HandleIncomingPub(string json, byte[]? senderIdentity)
    {
        try
        {
            var message =
                JsonSerializer.Deserialize<BusMessage>(json, BusJson.Options)
                ?? throw new InvalidOperationException("null BusMessage");
            await Task.Run(() => _inbound.Deliver(message)).ConfigureAwait(false);

            if (_mode == BusMode.Server)
            {
                // Fan out to every client except the sender.
                BroadcastPub(json, except: senderIdentity);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to deliver published bus message");
        }
    }

    void BroadcastPub(string payloadJson, byte[]? except = null)
    {
        foreach (var (_, identity) in _knownClients)
        {
            if (
                except is not null
                && identity.Length == except.Length
                && identity.AsSpan().SequenceEqual(except)
            )
            {
                continue;
            }

            lock (_sendGate)
            {
                _router!
                    .SendMoreFrame(identity)
                    .SendMoreFrameEmpty()
                    .SendMoreFrame("pub")
                    .SendFrame(payloadJson);
            }
        }
    }

    readonly ZeroMqBusOptions _options;
    readonly IMessageBusInbound _inbound;
    readonly ILogger<ZeroMqMessageBusProvider> _logger;
    readonly BusMode _mode;
    readonly ConcurrentDictionary<string, TaskCompletionSource<BusReply>> _pending = new();
    readonly ConcurrentDictionary<string, byte[]> _knownClients = new();
    readonly object _sendGate = new();

    RouterSocket? _router;
    DealerSocket? _dealer;
    NetMQPoller? _poller;
    NetMQMessage? _routerMsg = new();
    NetMQMessage? _dealerMsg = new();
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
        _mode = options.Mode;
    }
}
