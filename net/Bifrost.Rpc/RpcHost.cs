using System.Collections.Concurrent;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Bifrost.Rpc;

public sealed class RpcHost : IRpcHost, IRpcEndpoint
{
    public string SocketPath => _socketPath;

    public bool IsRunning => _started == 1 && _disposed == 0;

    public IReadOnlyList<RpcInstanceStatus> Instances =>
        _options
            .Instances.Select(i => new RpcInstanceStatus(
                i.Id,
                i.Role,
                _connections.ContainsKey(i.Id)
            ))
            .ToArray();

    public RpcSession GroupSession { get; }

    public IReadOnlyList<RpcSession> Sessions =>
        _connections.Values.Select(c => c.Session).ToArray();

    public void AddSubscriber(Action<RpcSession> subscribe)
    {
        ArgumentNullException.ThrowIfNull(subscribe);

        lock (_gate)
        {
            _subscribers.Add(subscribe);
        }

        foreach (var session in Sessions)
        {
            subscribe(session);
        }
    }

    public async Task Start(CancellationToken cancellationToken = default)
    {
        if (Interlocked.CompareExchange(ref _started, 1, 0) != 0)
        {
            return;
        }

        _options.Validate();
        _primaryId = _options.Instances.Single(i => i.Role == RpcRole.Primary).Id;
        _socketPath = string.IsNullOrWhiteSpace(_options.SocketPath)
            ? Path.Combine(Path.GetTempPath(), $"bifrost-rpc-{Guid.NewGuid():N}.sock")
            : _options.SocketPath;

        var dir = Path.GetDirectoryName(_socketPath);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }

        if (File.Exists(_socketPath))
        {
            File.Delete(_socketPath);
        }

        _runCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _allReady = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        _listenSocket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
        _listenSocket.Bind(new UnixDomainSocketEndPoint(_socketPath));
        _listenSocket.Listen(Math.Max(4, _options.Instances.Count * 2));

        _acceptLoop = Task.Run(() => AcceptLoop(_runCts.Token), CancellationToken.None);

        if (_options.LaunchProcesses)
        {
            foreach (var instance in _options.Instances)
            {
                var process = new RpcProcess(instance, _socketPath);
                _processes.Add(process);
                process.Start();
            }
        }

        if (!_options.WaitForReadyOnStart)
        {
            return;
        }

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(_options.ReadyTimeout);

        try
        {
            await _allReady.Task.WaitAsync(timeoutCts.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            await Stop(CancellationToken.None).ConfigureAwait(false);
            throw new TimeoutException(
                $"RPC instances did not become ready within {_options.ReadyTimeout}. "
                    + $"Connected: [{string.Join(", ", _connections.Keys)}]"
            );
        }
    }

    public async Task Stop(CancellationToken cancellationToken = default)
    {
        if (_runCts is null)
        {
            return;
        }

        foreach (var connection in _connections.Values)
        {
            try
            {
                await connection
                    .Session.Notify(RpcMethods.Shutdown, cancellationToken: cancellationToken)
                    .ConfigureAwait(false);
            }
            catch { }
        }

        await Task.Delay(50, cancellationToken).ConfigureAwait(false);

        foreach (var process in _processes)
        {
            await process.Stop(_options.ShutdownTimeout, cancellationToken).ConfigureAwait(false);
        }

        await _runCts.CancelAsync().ConfigureAwait(false);

        try
        {
            _listenSocket?.Dispose();
        }
        catch { }

        if (_acceptLoop is not null)
        {
            try
            {
                await _acceptLoop.ConfigureAwait(false);
            }
            catch { }
        }

        foreach (var connection in _connections.Values)
        {
            await connection.DisposeAsync().ConfigureAwait(false);
        }

        _connections.Clear();

        foreach (var process in _processes)
        {
            await process.DisposeAsync().ConfigureAwait(false);
        }

        _processes.Clear();

        TryDeleteSocket();
        Interlocked.Exchange(ref _started, 0);
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return;
        }

        try
        {
            await Stop().ConfigureAwait(false);
        }
        catch { }

        _runCts?.Dispose();
    }

    RpcSession PrimarySession()
    {
        if (_primaryId is null || !_connections.TryGetValue(_primaryId, out var primary))
        {
            throw new JsonRpcException(
                JsonRpcErrorCodes.PrimaryUnavailable,
                $"Primary instance '{_primaryId ?? "(unconfigured)"}' is not connected."
            );
        }

        return primary.Session;
    }

    async Task AcceptLoop(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            Socket client;
            try
            {
                client = await _listenSocket!.AcceptAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (ObjectDisposedException)
            {
                break;
            }
            catch (SocketException)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    break;
                }

                continue;
            }

            _ = Task.Run(() => HandleAccepted(client, cancellationToken), CancellationToken.None);
        }
    }

    async Task HandleAccepted(Socket client, CancellationToken cancellationToken)
    {
        NetworkStream? stream = null;
        RpcSession? session = null;
        try
        {
            stream = new NetworkStream(client, ownsSocket: true);
            session = RpcSession.FromStream(stream);

            // Inbound handlers go on before the read loop starts, so a peer that calls us
            // immediately after its handshake cannot race registration.
            Action<RpcSession>[] subscribers;
            lock (_gate)
            {
                subscribers = [.. _subscribers];
            }

            foreach (var subscribe in subscribers)
            {
                subscribe(session);
            }

            var readyTcs = new TaskCompletionSource<ReadyPayload>(
                TaskCreationOptions.RunContinuationsAsynchronously
            );
            session.Map(
                RpcMethods.Ready,
                (paramsElement, _) =>
                {
                    var payload = ParseReady(paramsElement);
                    readyTcs.TrySetResult(payload);
                    return Task.FromResult<object?>(new { ok = true });
                }
            );
            session.Map(RpcMethods.Ping, (_, _) => Task.FromResult<object?>(new { ok = true }));

            session.Start();

            ReadyPayload ready;
            using (
                var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken)
            )
            {
                timeoutCts.CancelAfter(_options.ReadyTimeout);
                ready = await readyTcs.Task.WaitAsync(timeoutCts.Token).ConfigureAwait(false);
            }

            if (!_options.Instances.Any(i => i.Id == ready.InstanceId))
            {
                _logger.LogWarning(
                    "Rejecting unknown RPC instance id {InstanceId}",
                    ready.InstanceId
                );
                await session.DisposeAsync().ConfigureAwait(false);
                return;
            }

            var connection = new InstanceConnection(ready.InstanceId, session, stream);
            if (!_connections.TryAdd(ready.InstanceId, connection))
            {
                _logger.LogWarning(
                    "Duplicate connection for RPC instance {InstanceId}; closing new one",
                    ready.InstanceId
                );
                await connection.DisposeAsync().ConfigureAwait(false);
                return;
            }

            _logger.LogInformation("RPC instance {InstanceId} connected", ready.InstanceId);
            CheckAllReady();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "RPC accept/handshake failed");
            if (session is not null)
            {
                await session.DisposeAsync().ConfigureAwait(false);
            }
            else if (stream is not null)
            {
                await stream.DisposeAsync().ConfigureAwait(false);
            }
            else
            {
                client.Dispose();
            }
        }
    }

    void CheckAllReady()
    {
        if (_allReady is null || _allReady.Task.IsCompleted)
        {
            return;
        }

        lock (_gate)
        {
            if (_allReady.Task.IsCompleted)
            {
                return;
            }

            if (_options.Instances.All(i => _connections.ContainsKey(i.Id)))
            {
                _allReady.TrySetResult();
            }
        }
    }

    static ReadyPayload ParseReady(JsonElement? paramsElement)
    {
        if (paramsElement is null || paramsElement.Value.ValueKind != JsonValueKind.Object)
        {
            throw new JsonRpcException(
                JsonRpcErrorCodes.InvalidParams,
                $"{RpcMethods.Ready} requires an object params payload."
            );
        }

        var p = paramsElement.Value;
        if (!p.TryGetProperty("instanceId", out var idEl) || idEl.ValueKind != JsonValueKind.String)
        {
            throw new JsonRpcException(
                JsonRpcErrorCodes.InvalidParams,
                $"{RpcMethods.Ready} requires an instanceId."
            );
        }

        var role =
            p.TryGetProperty("role", out var roleEl) && roleEl.ValueKind == JsonValueKind.String
                ? roleEl.GetString() ?? "shadow"
                : "shadow";

        return new ReadyPayload(idEl.GetString()!, role);
    }

    void TryDeleteSocket()
    {
        try
        {
            if (!string.IsNullOrEmpty(_socketPath) && File.Exists(_socketPath))
            {
                File.Delete(_socketPath);
            }
        }
        catch { }
    }

    sealed record ReadyPayload(string InstanceId, string Role);

    sealed class InstanceConnection : IAsyncDisposable
    {
        public string InstanceId { get; }
        public RpcSession Session { get; }

        public async ValueTask DisposeAsync()
        {
            await Session.DisposeAsync().ConfigureAwait(false);
            await _stream.DisposeAsync().ConfigureAwait(false);
        }

        readonly NetworkStream _stream;

        public InstanceConnection(string instanceId, RpcSession session, NetworkStream stream)
        {
            InstanceId = instanceId;
            Session = session;
            _stream = stream;
        }
    }

    readonly RpcHostOptions _options;
    readonly ILogger<RpcHost> _logger;
    readonly ConcurrentDictionary<string, InstanceConnection> _connections = new(
        StringComparer.Ordinal
    );
    readonly List<Action<RpcSession>> _subscribers = [];
    readonly object _gate = new();
    readonly List<RpcProcess> _processes = [];

    string _socketPath = "";
    Socket? _listenSocket;
    CancellationTokenSource? _runCts;
    Task? _acceptLoop;
    TaskCompletionSource? _allReady;
    string? _primaryId;
    int _started;
    int _disposed;

    public RpcHost(IOptions<RpcHostOptions> options, ILogger<RpcHost>? logger = null)
        : this(options.Value, logger) { }

    public RpcHost(RpcHostOptions options, ILogger<RpcHost>? logger = null)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _logger = logger ?? NullLogger<RpcHost>.Instance;
        GroupSession = RpcSession.CreateMultiplex(PrimarySession, () => Sessions);
    }
}
