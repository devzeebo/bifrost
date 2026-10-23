using System.Globalization;
using System.Net.Sockets;
using Microsoft.Extensions.Configuration;

namespace Bifrost.Rpc;

public sealed class RpcPeerOptions
{
    public required string SocketPath { get; init; }
    public required string InstanceId { get; init; }
    public string Role { get; init; } = "shadow";
    public TimeSpan ConnectTimeout { get; init; } = TimeSpan.FromSeconds(10);

    /// <summary>
    /// Reads <c>Rpc:SocketPath</c>, <c>Rpc:InstanceId</c>, and <c>Rpc:Role</c>.
    /// Role defaults to <c>shadow</c>.
    /// </summary>
    public static RpcPeerOptions FromConfiguration(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var section = configuration.GetSection("Rpc");

        var socket = section["SocketPath"];
        if (string.IsNullOrWhiteSpace(socket))
        {
            throw new InvalidOperationException("Missing Rpc:SocketPath.");
        }

        var instanceId = section["InstanceId"];
        if (string.IsNullOrWhiteSpace(instanceId))
        {
            throw new InvalidOperationException("Missing Rpc:InstanceId.");
        }

        var role = section["Role"];
        if (string.IsNullOrWhiteSpace(role))
        {
            role = "shadow";
        }

        var connectTimeout = TimeSpan.FromSeconds(10);
        var timeout = section["ConnectTimeout"];
        if (
            !string.IsNullOrWhiteSpace(timeout)
            && !TimeSpan.TryParse(timeout, CultureInfo.InvariantCulture, out connectTimeout)
        )
        {
            throw new InvalidOperationException($"Invalid Rpc:ConnectTimeout '{timeout}'.");
        }

        return new RpcPeerOptions
        {
            SocketPath = socket,
            InstanceId = instanceId,
            Role = role,
            ConnectTimeout = connectTimeout,
        };
    }
}

/// <summary>
/// The connecting side of an RPC pair: dials the host's Unix socket, announces readiness, and
/// serves the single resulting session.
/// </summary>
public sealed class RpcPeer : IRpcEndpoint, IAsyncDisposable
{
    /// <summary>Raised when the host sends <see cref="RpcMethods.Shutdown"/>.</summary>
    public event Action? ShutdownRequested;

    public RpcSession GroupSession { get; }

    public IReadOnlyList<RpcSession> Sessions => _session is null ? [] : [_session];

    public bool IsConnected => _session is not null;

    public void AddSubscriber(Action<RpcSession> subscribe)
    {
        ArgumentNullException.ThrowIfNull(subscribe);

        RpcSession? session;
        lock (_gate)
        {
            _subscribers.Add(subscribe);
            session = _session;
        }

        if (session is not null)
        {
            subscribe(session);
        }
    }

    public async Task Connect(CancellationToken cancellationToken = default)
    {
        if (_session is not null)
        {
            return;
        }

        var stream = await Dial(cancellationToken).ConfigureAwait(false);
        var session = RpcSession.FromStream(stream);

        // Inbound handlers go on before the read loop starts, so the host cannot call us before
        // we are ready to answer.
        Action<RpcSession>[] subscribers;
        lock (_gate)
        {
            subscribers = [.. _subscribers];
        }

        foreach (var subscribe in subscribers)
        {
            subscribe(session);
        }

        session.Map(
            RpcMethods.Shutdown,
            (_, _) =>
            {
                ShutdownRequested?.Invoke();
                return Task.FromResult<object?>(null);
            }
        );
        session.Map(RpcMethods.Ping, (_, _) => Task.FromResult<object?>(new { ok = true }));

        session.Start();

        try
        {
            using var handshakeCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken
            );
            handshakeCts.CancelAfter(_options.ConnectTimeout);
            await session
                .Invoke<object?>(
                    RpcMethods.Ready,
                    new { instanceId = _options.InstanceId, role = _options.Role },
                    handshakeCts.Token
                )
                .ConfigureAwait(false);
        }
        catch
        {
            await session.DisposeAsync().ConfigureAwait(false);
            await stream.DisposeAsync().ConfigureAwait(false);
            throw;
        }

        lock (_gate)
        {
            _stream = stream;
            _session = session;
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return;
        }

        if (_session is not null)
        {
            await _session.DisposeAsync().ConfigureAwait(false);
        }

        if (_stream is not null)
        {
            await _stream.DisposeAsync().ConfigureAwait(false);
        }
    }

    RpcSession SoleSession() =>
        _session
        ?? throw new JsonRpcException(
            JsonRpcErrorCodes.NotReady,
            "RPC peer is not connected; call Connect first."
        );

    /// <summary>
    /// Retries until <see cref="RpcPeerOptions.ConnectTimeout"/>: a launched peer can be ready
    /// before the host has finished binding the socket.
    /// </summary>
    async Task<NetworkStream> Dial(CancellationToken cancellationToken)
    {
        var endpoint = new UnixDomainSocketEndPoint(_options.SocketPath);
        var deadline = DateTime.UtcNow + _options.ConnectTimeout;
        Exception? last = null;

        while (true)
        {
            var socket = new Socket(
                AddressFamily.Unix,
                SocketType.Stream,
                ProtocolType.Unspecified
            );
            try
            {
                await socket.ConnectAsync(endpoint, cancellationToken).ConfigureAwait(false);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch (Exception ex)
            {
                socket.Dispose();
                cancellationToken.ThrowIfCancellationRequested();
                last = ex;
            }

            if (DateTime.UtcNow >= deadline)
            {
                throw new TimeoutException(
                    $"Could not connect to '{_options.SocketPath}' within {_options.ConnectTimeout}.",
                    last
                );
            }

            await Task.Delay(25, cancellationToken).ConfigureAwait(false);
        }
    }

    readonly RpcPeerOptions _options;
    readonly List<Action<RpcSession>> _subscribers = [];
    readonly object _gate = new();

    NetworkStream? _stream;
    RpcSession? _session;
    int _disposed;

    public RpcPeer(RpcPeerOptions options)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        ArgumentException.ThrowIfNullOrWhiteSpace(options.SocketPath);
        ArgumentException.ThrowIfNullOrWhiteSpace(options.InstanceId);
        GroupSession = RpcSession.CreateMultiplex(SoleSession, () => Sessions);
    }
}
