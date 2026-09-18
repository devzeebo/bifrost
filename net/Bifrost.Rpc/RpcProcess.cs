using System.Diagnostics;

namespace Bifrost.Rpc;

internal sealed class RpcProcess : IAsyncDisposable
{
    public string Id => _options.Id;

    public bool IsRunning => _process is { HasExited: false };

    public void Start()
    {
        if (_process is not null)
        {
            return;
        }

        var executable =
            _options.Executable
            ?? throw new InvalidOperationException(
                $"RPC instance '{_options.Id}' is missing Executable."
            );

        var startInfo = new ProcessStartInfo
        {
            FileName = executable,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };

        if (!string.IsNullOrWhiteSpace(_options.WorkingDirectory))
        {
            startInfo.WorkingDirectory = _options.WorkingDirectory;
        }

        foreach (var arg in _options.Arguments)
        {
            startInfo.ArgumentList.Add(arg);
        }

        startInfo.ArgumentList.Add(RpcConnectionKeys.SocketArg);
        startInfo.ArgumentList.Add(_socketPath);
        startInfo.ArgumentList.Add(RpcConnectionKeys.InstanceIdArg);
        startInfo.ArgumentList.Add(_options.Id);
        startInfo.ArgumentList.Add(RpcConnectionKeys.RoleArg);
        startInfo.ArgumentList.Add(_options.Role == RpcRole.Primary ? "primary" : "shadow");

        startInfo.Environment[RpcConnectionKeys.SocketEnv] = _socketPath;
        startInfo.Environment[RpcConnectionKeys.InstanceIdEnv] = _options.Id;
        startInfo.Environment[RpcConnectionKeys.RoleEnv] =
            _options.Role == RpcRole.Primary ? "primary" : "shadow";

        foreach (var (key, value) in _options.Environment)
        {
            startInfo.Environment[key] = value;
        }

        _process =
            Process.Start(startInfo)
            ?? throw new InvalidOperationException(
                $"Failed to start RPC peer process '{_options.Id}'."
            );

        // Prevent pipe buffer deadlocks if the peer writes a lot
        _process.OutputDataReceived += (_, _) => { };
        _process.ErrorDataReceived += (_, _) => { };
        _process.BeginOutputReadLine();
        _process.BeginErrorReadLine();
    }

    public async Task Stop(TimeSpan gracefulTimeout, CancellationToken cancellationToken = default)
    {
        if (_process is null || _process.HasExited)
        {
            return;
        }

        try
        {
            _process.Kill(entireProcessTree: true);
        }
        catch
        {
            // already exited
        }

        try
        {
            await _process
                .WaitForExitAsync(cancellationToken)
                .WaitAsync(gracefulTimeout, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (TimeoutException)
        {
            // ignored — already killed
        }
        catch (OperationCanceledException)
        {
            // ignored
        }
    }

    public ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0)
        {
            return ValueTask.CompletedTask;
        }

        if (_process is not null)
        {
            try
            {
                if (!_process.HasExited)
                {
                    _process.Kill(entireProcessTree: true);
                }
            }
            catch
            {
                // ignored
            }

            _process.Dispose();
        }

        return ValueTask.CompletedTask;
    }

    readonly RpcInstanceOptions _options;
    readonly string _socketPath;
    Process? _process;
    int _disposed;

    public RpcProcess(RpcInstanceOptions options, string socketPath)
    {
        _options = options;
        _socketPath = socketPath;
    }
}
