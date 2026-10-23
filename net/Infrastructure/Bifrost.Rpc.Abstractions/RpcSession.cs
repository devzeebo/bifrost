using System.Collections.Concurrent;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace Bifrost.Rpc;

/// <summary>
/// Bidirectional NDJSON JSON-RPC 2.0 session. Used by both host and peer.
/// Create from a stream, or via <see cref="CreateMultiplex"/> for shadow-ops fan-out.
/// </summary>
public sealed class RpcSession : IAsyncDisposable
{
    public bool IsMultiplex => _isMultiplex;

    public static RpcSession FromStream(Stream stream)
    {
        ArgumentNullException.ThrowIfNull(stream);
        return new RpcSession(stream);
    }

    /// <summary>
    /// Shadow-ops session: Invoke/Notify fan out to every member; results come from the primary only.
    /// Both providers are queried per call, so the returned session stays valid as instances
    /// connect and reconnect. <paramref name="primary"/> should throw
    /// <see cref="JsonRpcException"/> with <see cref="JsonRpcErrorCodes.PrimaryUnavailable"/>
    /// when there is nothing to call.
    /// </summary>
    public static RpcSession CreateMultiplex(
        Func<RpcSession> primary,
        Func<IReadOnlyList<RpcSession>> members
    )
    {
        ArgumentNullException.ThrowIfNull(primary);
        ArgumentNullException.ThrowIfNull(members);
        return new RpcSession(primary, members);
    }

    public void Map(
        string method,
        Func<JsonElement?, CancellationToken, ValueTask<object?>> handler
    )
    {
        EnsureStream();
        ArgumentException.ThrowIfNullOrWhiteSpace(method);
        ArgumentNullException.ThrowIfNull(handler);
        _handlers![method] = handler;
    }

    public void Map(string method, Func<JsonElement?, CancellationToken, Task<object?>> handler) =>
        Map(method, (p, ct) => new ValueTask<object?>(handler(p, ct)));

    public void Start()
    {
        if (_isMultiplex)
        {
            return;
        }

        if (_readLoop is not null)
        {
            return;
        }

        _readLoop = Task.Run(() => ReadLoop(_sessionCts!.Token));
    }

    public async Task<TResult> Invoke<TResult>(
        string method,
        object? @params = null,
        CancellationToken cancellationToken = default
    )
    {
        if (_isMultiplex)
        {
            return await InvokeMultiplex<TResult>(method, @params, cancellationToken)
                .ConfigureAwait(false);
        }

        var id = Interlocked.Increment(ref _nextId).ToString();
        var tcs = new TaskCompletionSource<JsonElement>(
            TaskCreationOptions.RunContinuationsAsynchronously
        );
        if (!_pending!.TryAdd(id, tcs))
        {
            throw new InvalidOperationException($"Duplicate request id '{id}'.");
        }

        await using var reg = cancellationToken.Register(() =>
            tcs.TrySetCanceled(cancellationToken)
        );

        try
        {
            await WriteMessage(
                    new Dictionary<string, object?>
                    {
                        ["jsonrpc"] = "2.0",
                        ["method"] = method,
                        ["params"] = @params is null
                            ? null
                            : JsonSerializer.SerializeToElement(@params, SerializerOptions),
                        ["id"] = id,
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);

            var result = await tcs.Task.ConfigureAwait(false);
            return DeserializeResult<TResult>(result);
        }
        finally
        {
            _pending.TryRemove(id, out _);
        }
    }

    public async Task Notify(
        string method,
        object? @params = null,
        CancellationToken cancellationToken = default
    )
    {
        if (_isMultiplex)
        {
            foreach (var session in _membersProvider!())
            {
                try
                {
                    await session.Notify(method, @params, cancellationToken).ConfigureAwait(false);
                }
                catch
                {
                    // best-effort fan-out
                }
            }

            return;
        }

        await WriteMessage(
                new Dictionary<string, object?>
                {
                    ["jsonrpc"] = "2.0",
                    ["method"] = method,
                    ["params"] = @params is null
                        ? null
                        : JsonSerializer.SerializeToElement(@params, SerializerOptions),
                },
                cancellationToken
            )
            .ConfigureAwait(false);
    }

    public static async Task<RpcSession> ConnectUnix(
        string socketPath,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(socketPath);
        var socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
        try
        {
            await socket
                .ConnectAsync(new UnixDomainSocketEndPoint(socketPath), cancellationToken)
                .ConfigureAwait(false);
        }
        catch
        {
            socket.Dispose();
            throw;
        }

        var stream = new NetworkStream(socket, ownsSocket: true);
        var session = FromStream(stream);
        session.Start();
        return session;
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return;
        }

        if (_isMultiplex)
        {
            // Does not own member sessions
            return;
        }

        await _sessionCts!.CancelAsync().ConfigureAwait(false);
        if (_readLoop is not null)
        {
            try
            {
                await _readLoop.ConfigureAwait(false);
            }
            catch { }
        }

        FailPending(new ObjectDisposedException(nameof(RpcSession)));
        _writeLock!.Dispose();
        await _writer!.DisposeAsync().ConfigureAwait(false);
        _sessionCts.Dispose();
    }

    internal Task<JsonElement> WaitForResponse(
        string id,
        CancellationToken cancellationToken = default
    )
    {
        EnsureStream();
        var tcs = new TaskCompletionSource<JsonElement>(
            TaskCreationOptions.RunContinuationsAsynchronously
        );
        if (!_pending!.TryAdd(id, tcs))
        {
            throw new InvalidOperationException($"Duplicate request id '{id}'.");
        }

        cancellationToken.Register(() =>
        {
            if (tcs.TrySetCanceled(cancellationToken))
            {
                _pending.TryRemove(id, out _);
            }
        });

        return tcs.Task.ContinueWith(
            t =>
            {
                _pending.TryRemove(id, out _);
                return t.GetAwaiter().GetResult();
            },
            CancellationToken.None,
            TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default
        );
    }

    internal async Task SendRequest(
        string id,
        string method,
        object? @params = null,
        CancellationToken cancellationToken = default
    )
    {
        EnsureStream();
        await WriteMessage(
                new Dictionary<string, object?>
                {
                    ["jsonrpc"] = "2.0",
                    ["method"] = method,
                    ["params"] = @params is null
                        ? null
                        : JsonSerializer.SerializeToElement(@params, SerializerOptions),
                    ["id"] = id,
                },
                cancellationToken
            )
            .ConfigureAwait(false);
    }

    async Task<TResult> InvokeMultiplex<TResult>(
        string method,
        object? @params,
        CancellationToken cancellationToken
    )
    {
        var primary = _primaryProvider!();
        var members = _membersProvider!();
        var all = members.Contains(primary) ? members : [.. members, primary];
        var id = Guid.NewGuid().ToString("N");

        var primaryWait = primary.WaitForResponse(id, cancellationToken);
        var shadowWaits = new List<Task>();
        foreach (var session in all)
        {
            if (ReferenceEquals(session, primary))
            {
                continue;
            }

            shadowWaits.Add(DrainShadow(session.WaitForResponse(id, cancellationToken)));
        }

        foreach (var session in all)
        {
            try
            {
                await session
                    .SendRequest(id, method, @params, cancellationToken)
                    .ConfigureAwait(false);
            }
            catch
            {
                if (ReferenceEquals(session, primary))
                {
                    throw;
                }
            }
        }

        var result = await primaryWait.ConfigureAwait(false);
        _ = Task.WhenAll(shadowWaits);
        return DeserializeResult<TResult>(result);
    }

    static async Task DrainShadow(Task<JsonElement> wait)
    {
        try
        {
            await wait.ConfigureAwait(false);
        }
        catch
        {
            // discarded
        }
    }

    static TResult DeserializeResult<TResult>(JsonElement result)
    {
        if (typeof(TResult) == typeof(JsonElement))
        {
            return (TResult)(object)result;
        }

        return result.Deserialize<TResult>(SerializerOptions)!;
    }

    void EnsureStream()
    {
        if (_isMultiplex)
        {
            throw new NotSupportedException(
                "Multiplex RpcSession does not support Map/Send on the group; use per-connection sessions for inbound handlers."
            );
        }
    }

    async Task ReadLoop(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(
            _stream!,
            Encoding.UTF8,
            detectEncodingFromByteOrderMarks: false,
            bufferSize: 4096,
            leaveOpen: true
        );

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false);
                if (line is null)
                {
                    break;
                }

                if (string.IsNullOrWhiteSpace(line))
                {
                    continue;
                }

                await HandleLine(line, cancellationToken).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (IOException) { }
        finally
        {
            FailPending(new IOException("RPC session closed."));
        }
    }

    async Task HandleLine(string line, CancellationToken cancellationToken)
    {
        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(line);
        }
        catch (JsonException ex)
        {
            await WriteMessage(
                    new Dictionary<string, object?>
                    {
                        ["jsonrpc"] = "2.0",
                        ["error"] = new
                        {
                            code = JsonRpcErrorCodes.ParseError,
                            message = ex.Message,
                        },
                        ["id"] = null,
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);
            return;
        }

        using (doc)
        {
            var root = doc.RootElement;
            if (root.TryGetProperty("method", out _))
            {
                await HandleRequest(root, cancellationToken).ConfigureAwait(false);
                return;
            }

            if (
                root.TryGetProperty("id", out var idElement)
                && idElement.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined
            )
            {
                var id =
                    idElement.ValueKind == JsonValueKind.String
                        ? idElement.GetString()!
                        : idElement.GetRawText();

                if (_pending!.TryRemove(id, out var tcs))
                {
                    if (
                        root.TryGetProperty("error", out var error)
                        && error.ValueKind != JsonValueKind.Null
                    )
                    {
                        var code = error.TryGetProperty("code", out var codeEl)
                            ? codeEl.GetInt32()
                            : JsonRpcErrorCodes.InternalError;
                        var message = error.TryGetProperty("message", out var msgEl)
                            ? msgEl.GetString() ?? "RPC error"
                            : "RPC error";
                        tcs.TrySetException(new JsonRpcException(code, message));
                    }
                    else if (root.TryGetProperty("result", out var result))
                    {
                        tcs.TrySetResult(result.Clone());
                    }
                    else
                    {
                        tcs.TrySetResult(default);
                    }
                }
            }
        }
    }

    async Task HandleRequest(JsonElement root, CancellationToken cancellationToken)
    {
        var method = root.GetProperty("method").GetString() ?? string.Empty;
        JsonElement? id =
            root.TryGetProperty("id", out var idEl)
            && idEl.ValueKind is not JsonValueKind.Null and not JsonValueKind.Undefined
                ? idEl.Clone()
                : null;
        JsonElement? paramsElement = root.TryGetProperty("params", out var p) ? p.Clone() : null;

        if (!_handlers!.TryGetValue(method, out var handler))
        {
            if (id is not null)
            {
                await WriteMessage(
                        new Dictionary<string, object?>
                        {
                            ["jsonrpc"] = "2.0",
                            ["error"] = new
                            {
                                code = JsonRpcErrorCodes.MethodNotFound,
                                message = $"Method '{method}' not found.",
                            },
                            ["id"] = IdToObject(id.Value),
                        },
                        cancellationToken
                    )
                    .ConfigureAwait(false);
            }

            return;
        }

        if (id is null)
        {
            try
            {
                await handler(paramsElement, cancellationToken).ConfigureAwait(false);
            }
            catch { }

            return;
        }

        try
        {
            var result = await handler(paramsElement, cancellationToken).ConfigureAwait(false);
            await WriteMessage(
                    new Dictionary<string, object?>
                    {
                        ["jsonrpc"] = "2.0",
                        ["result"] = result is null
                            ? null
                            : JsonSerializer.SerializeToElement(result, SerializerOptions),
                        ["id"] = IdToObject(id.Value),
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            await WriteMessage(
                    new Dictionary<string, object?>
                    {
                        ["jsonrpc"] = "2.0",
                        ["error"] = new
                        {
                            code = JsonRpcErrorCodes.InternalError,
                            message = ex.Message,
                        },
                        ["id"] = IdToObject(id.Value),
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);
        }
    }

    static object? IdToObject(JsonElement id) =>
        id.ValueKind switch
        {
            JsonValueKind.String => id.GetString(),
            JsonValueKind.Number => id.TryGetInt64(out var l) ? l : id.GetDouble(),
            JsonValueKind.Null => null,
            _ => id.GetRawText(),
        };

    async Task WriteMessage(object message, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(message, SerializerOptions);
        await _writeLock!.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await _writer!.WriteLineAsync(json.AsMemory(), cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    void FailPending(Exception ex)
    {
        if (_pending is null)
        {
            return;
        }

        foreach (var key in _pending.Keys)
        {
            if (_pending.TryRemove(key, out var tcs))
            {
                tcs.TrySetException(ex);
            }
        }
    }

    public static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    readonly Stream? _stream;
    readonly StreamWriter? _writer;
    readonly SemaphoreSlim? _writeLock;
    readonly ConcurrentDictionary<string, TaskCompletionSource<JsonElement>>? _pending;
    readonly ConcurrentDictionary<
        string,
        Func<JsonElement?, CancellationToken, ValueTask<object?>>
    >? _handlers;
    readonly CancellationTokenSource? _sessionCts;
    readonly Func<RpcSession>? _primaryProvider;
    readonly Func<IReadOnlyList<RpcSession>>? _membersProvider;
    readonly bool _isMultiplex;
    long _nextId;
    Task? _readLoop;
    int _disposed;

    RpcSession(Stream stream)
    {
        _isMultiplex = false;
        _stream = stream;
        _writeLock = new SemaphoreSlim(1, 1);
        _pending = new ConcurrentDictionary<string, TaskCompletionSource<JsonElement>>();
        _handlers =
            new ConcurrentDictionary<
                string,
                Func<JsonElement?, CancellationToken, ValueTask<object?>>
            >();
        _sessionCts = new CancellationTokenSource();
        _writer = new StreamWriter(
            stream,
            new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
            bufferSize: 4096,
            leaveOpen: true
        )
        {
            AutoFlush = true,
            NewLine = "\n",
        };
    }

    RpcSession(Func<RpcSession> primary, Func<IReadOnlyList<RpcSession>> members)
    {
        _isMultiplex = true;
        _primaryProvider = primary;
        _membersProvider = members;
    }
}
