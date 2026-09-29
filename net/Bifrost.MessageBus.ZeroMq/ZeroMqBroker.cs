using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NetMQ;
using NetMQ.Sockets;

namespace Bifrost.MessageBus.ZeroMq;

/// <summary>
/// Central ROUTER. Sidecars are DEALERs. <c>pub</c> is copied to every other sidecar.
/// <c>req</c> is forwarded to <see cref="ZeroMqBrokerOptions.CommandAddress"/> and the
/// matching <c>rep</c> is sent back to the caller.
/// </summary>
sealed class ZeroMqBroker : IHostedService, IDisposable
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _router = new RouterSocket();
        _router.Bind(_options.BindEndpoint);
        _router.ReceiveReady += OnReceive;
        _poller = new NetMQPoller { _router };
        _poller.RunAsync();
        _logger.LogInformation(
            "ZeroMQ broker listening on {Endpoint}; commands go to {Address}",
            _options.BindEndpoint,
            _options.CommandAddress
        );
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        Dispose();
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
        _router?.Dispose();
    }

    void OnReceive(object? sender, NetMQSocketEventArgs args)
    {
        var message = new NetMQMessage();
        while (_router!.TryReceiveMultipartMessage(ref message))
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

        var identity = message[0].ToByteArray();
        var address = Encoding.UTF8.GetString(identity);
        if (address.Length > 0)
        {
            _clients[address] = identity;
        }

        var offset = message[1].MessageSize == 0 ? 2 : 1;
        if (message.FrameCount <= offset)
        {
            return;
        }

        var type = message[offset].ConvertToString();
        if (type == "pub" && message.FrameCount >= offset + 2)
        {
            Broadcast(identity, message[offset + 1].ConvertToString());
        }
        else if (type == "req" && message.FrameCount >= offset + 3)
        {
            ForwardRequest(
                identity,
                message[offset + 1].ConvertToString(),
                message[offset + 2].ConvertToString()
            );
        }
        else if (type == "rep" && message.FrameCount >= offset + 3)
        {
            ForwardReply(message[offset + 1].ConvertToString(), message[offset + 2].ConvertToString());
        }
    }

    void Broadcast(byte[] sender, string payload)
    {
        foreach (var (_, identity) in _clients)
        {
            if (identity.AsSpan().SequenceEqual(sender))
            {
                continue;
            }

            Send(identity, "pub", payload);
        }
    }

    void ForwardRequest(byte[] requester, string correlationId, string payload)
    {
        if (!_clients.TryGetValue(_options.CommandAddress, out var worker))
        {
            Send(
                requester,
                "rep",
                correlationId,
                JsonSerializer.Serialize(
                    new BusReply
                    {
                        Error = new BusError
                        {
                            Code = BusErrorCodes.Internal,
                            Message =
                                $"Command worker '{_options.CommandAddress}' is not connected.",
                        },
                    },
                    BusJson.Options
                )
            );
            return;
        }

        _pending[correlationId] = requester;
        Send(worker, "req", correlationId, payload);
    }

    void ForwardReply(string correlationId, string payload)
    {
        if (!_pending.TryRemove(correlationId, out var requester))
        {
            return;
        }

        Send(requester, "rep", correlationId, payload);
    }

    void Send(byte[] identity, string type, string correlationOrPayload, string? payload = null)
    {
        lock (_sendGate)
        {
            var router = _router!.SendMoreFrame(identity).SendMoreFrameEmpty().SendMoreFrame(type);
            if (payload is null)
            {
                router.SendFrame(correlationOrPayload);
            }
            else
            {
                router.SendMoreFrame(correlationOrPayload).SendFrame(payload);
            }
        }
    }

    readonly ZeroMqBrokerOptions _options;
    readonly ILogger<ZeroMqBroker> _logger;
    readonly ConcurrentDictionary<string, byte[]> _clients = new(StringComparer.Ordinal);
    readonly ConcurrentDictionary<string, byte[]> _pending = new(StringComparer.Ordinal);
    readonly object _sendGate = new();

    RouterSocket? _router;
    NetMQPoller? _poller;
    int _disposed;

    public ZeroMqBroker(ZeroMqBrokerOptions options, ILogger<ZeroMqBroker> logger)
    {
        _options = options;
        _logger = logger;
        ArgumentException.ThrowIfNullOrWhiteSpace(options.BindEndpoint);
        ArgumentException.ThrowIfNullOrWhiteSpace(options.CommandAddress);
    }
}
