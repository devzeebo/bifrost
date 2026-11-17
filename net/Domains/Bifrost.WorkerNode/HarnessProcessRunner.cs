using System.Diagnostics;
using System.Text;
using Microsoft.Extensions.Options;

namespace Bifrost.WorkerNode;

public sealed class HarnessProcessResult
{
    public bool Started { get; init; }
    public string? StartError { get; init; }
    public int? ExitCode { get; init; }
    public string StandardOutput { get; init; } = "";
    public string StandardError { get; init; } = "";
    public bool TimedOut { get; init; }
}

public interface IHarnessProcessRunner
{
    Task<HarnessProcessResult> Run(
        string workingDirectory,
        IReadOnlyDictionary<string, string> extraEnvironment,
        CancellationToken cancellationToken,
        string? executable = null,
        IReadOnlyList<string>? arguments = null
    );
}

public sealed class HarnessProcessRunner(IOptions<HarnessHostOptions> options) : IHarnessProcessRunner
{
    public const string StdoutLogFileName = "stdout.log";
    public const string StderrLogFileName = "stderr.log";
    static readonly TimeSpan CleanupDrainTimeout = TimeSpan.FromSeconds(5);

    public async Task<HarnessProcessResult> Run(
        string workingDirectory,
        IReadOnlyDictionary<string, string> extraEnvironment,
        CancellationToken cancellationToken,
        string? executable = null,
        IReadOnlyList<string>? arguments = null
    )
    {
        var opts = options.Value;
        var fileName = string.IsNullOrWhiteSpace(executable) ? opts.Executable : executable;
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return new HarnessProcessResult
            {
                Started = false,
                StartError = "harness failed to start: Executable is not configured",
            };
        }

        var resolvedArguments = arguments ?? opts.Arguments;
        var stdoutPath = Path.Combine(workingDirectory, StdoutLogFileName);
        var stderrPath = Path.Combine(workingDirectory, StderrLogFileName);

        StreamWriter stdoutLog;
        StreamWriter stderrLog;
        try
        {
            stdoutLog = new StreamWriter(
                new FileStream(stdoutPath, FileMode.Create, FileAccess.Write, FileShare.Read)
            )
            {
                AutoFlush = true,
            };
            stderrLog = new StreamWriter(
                new FileStream(stderrPath, FileMode.Create, FileAccess.Write, FileShare.Read)
            )
            {
                AutoFlush = true,
            };
        }
        catch (Exception ex)
        {
            return new HarnessProcessResult
            {
                Started = false,
                StartError = $"harness failed to start: could not open log files: {ex.Message}",
            };
        }

        await using (stdoutLog)
        await using (stderrLog)
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = fileName,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = workingDirectory,
            };

            foreach (var arg in resolvedArguments)
            {
                startInfo.ArgumentList.Add(arg);
            }

            foreach (var (key, value) in opts.Environment)
            {
                startInfo.Environment[key] = value;
            }

            foreach (var (key, value) in extraEnvironment)
            {
                startInfo.Environment[key] = value;
            }

            Process process;
            try
            {
                process =
                    Process.Start(startInfo)
                    ?? throw new InvalidOperationException(
                        $"Failed to start harness process '{fileName}'."
                    );
            }
            catch (Exception ex)
            {
                return new HarnessProcessResult
                {
                    Started = false,
                    StartError = $"harness failed to start: {ex.Message}",
                };
            }

            try
            {
                var stdout = new StringBuilder();
                var stderr = new StringBuilder();
                var stdoutLock = new object();
                var stderrLock = new object();
                using var logFailCts = new CancellationTokenSource();
                Exception? logFailure = null;

                process.OutputDataReceived += (_, e) =>
                {
                    if (e.Data is null)
                    {
                        return;
                    }

                    lock (stdoutLock)
                    {
                        try
                        {
                            stdoutLog.WriteLine(e.Data);
                        }
                        catch (Exception ex)
                        {
                            Interlocked.CompareExchange(ref logFailure, ex, null);
                            try
                            {
                                logFailCts.Cancel();
                            }
                            catch
                            {
                                // ignored
                            }
                        }

                        if (stdout.Length < 64 * 1024)
                        {
                            stdout.AppendLine(e.Data);
                        }
                    }
                };
                process.ErrorDataReceived += (_, e) =>
                {
                    if (e.Data is null)
                    {
                        return;
                    }

                    lock (stderrLock)
                    {
                        try
                        {
                            stderrLog.WriteLine(e.Data);
                        }
                        catch (Exception ex)
                        {
                            Interlocked.CompareExchange(ref logFailure, ex, null);
                            try
                            {
                                logFailCts.Cancel();
                            }
                            catch
                            {
                                // ignored
                            }
                        }

                        if (stderr.Length < 64 * 1024)
                        {
                            stderr.AppendLine(e.Data);
                        }
                    }
                };
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

                using var timeoutCts = new CancellationTokenSource();
                var timeout = opts.ExecutionTimeout;
                var hasTimeout = timeout is { } t && t > TimeSpan.Zero;
                if (hasTimeout)
                {
                    timeoutCts.CancelAfter(timeout!.Value);
                }

                using var linked = CancellationTokenSource.CreateLinkedTokenSource(
                    cancellationToken,
                    timeoutCts.Token,
                    logFailCts.Token
                );

                try
                {
                    await process.WaitForExitAsync(linked.Token).ConfigureAwait(false);
                    return new HarnessProcessResult
                    {
                        Started = true,
                        ExitCode = process.ExitCode,
                        StandardOutput = stdout.ToString(),
                        StandardError = stderr.ToString(),
                    };
                }
                catch (OperationCanceledException)
                {
                    var logFailed = logFailCts.IsCancellationRequested;
                    var timedOut =
                        !logFailed
                        && hasTimeout
                        && timeoutCts.IsCancellationRequested
                        && !cancellationToken.IsCancellationRequested;

                    await StopWorkload(process, fileName, resolvedArguments).ConfigureAwait(false);

                    if (logFailed)
                    {
                        return new HarnessProcessResult
                        {
                            Started = true,
                            ExitCode = process.HasExited ? process.ExitCode : null,
                            StandardOutput = stdout.ToString(),
                            StandardError = stderr.ToString(),
                            StartError =
                                $"harness logging failed: {logFailure?.Message ?? "could not write stdout/stderr logs"}",
                        };
                    }

                    if (timedOut)
                    {
                        return new HarnessProcessResult
                        {
                            Started = true,
                            ExitCode = process.HasExited ? process.ExitCode : null,
                            StandardOutput = stdout.ToString(),
                            StandardError = stderr.ToString(),
                            TimedOut = true,
                            StartError =
                                $"execution exceeded the configured ceiling of {FormatTimeout(timeout!.Value)}",
                        };
                    }

                    return new HarnessProcessResult
                    {
                        Started = true,
                        ExitCode = process.HasExited ? process.ExitCode : null,
                        StandardOutput = stdout.ToString(),
                        StandardError = stderr.ToString(),
                        StartError = process.HasExited ? null : "harness ended without a clean exit",
                    };
                }
            }
            finally
            {
                process.Dispose();
            }
        }
    }

    static async Task StopWorkload(
        Process process,
        string fileName,
        IReadOnlyList<string>? arguments
    )
    {
        // Script nodes use `docker run`; killing only the CLI leaves the container running.
        TryKillNamedDockerContainer(fileName, arguments);

        try
        {
            // Always attempt tree kill — parent may have exited while descendants hold pipes.
            process.Kill(entireProcessTree: true);
        }
        catch
        {
            // ignored
        }

        using var drainCts = new CancellationTokenSource(CleanupDrainTimeout);
        try
        {
            await process.WaitForExitAsync(drainCts.Token).ConfigureAwait(false);
        }
        catch
        {
            // ignored — bound drain so the serial slot is released
        }
    }

    static void TryKillNamedDockerContainer(
        string fileName,
        IReadOnlyList<string>? arguments
    )
    {
        if (!DockerContainerName.IsDockerExecutable(fileName))
        {
            return;
        }

        var name = DockerContainerName.TryReadFromArguments(arguments);
        if (name is null)
        {
            return;
        }

        try
        {
            using var kill = Process.Start(
                new ProcessStartInfo
                {
                    FileName = fileName,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    ArgumentList = { "kill", name },
                }
            );
            kill?.WaitForExit(30_000);
        }
        catch
        {
            // ignored — best effort; process.Kill below remains the fallback
        }
    }

    static string FormatTimeout(TimeSpan timeout) =>
        timeout.TotalHours >= 1 && timeout.Minutes == 0 && timeout.Seconds == 0
            ? $"{timeout.TotalHours:0}h"
            : timeout.ToString();
}
