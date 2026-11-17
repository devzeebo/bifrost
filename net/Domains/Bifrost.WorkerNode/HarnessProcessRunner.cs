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

        var startInfo = new ProcessStartInfo
        {
            FileName = fileName,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            WorkingDirectory = workingDirectory,
        };

        foreach (var arg in arguments ?? opts.Arguments)
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

        var stdoutPath = Path.Combine(workingDirectory, StdoutLogFileName);
        var stderrPath = Path.Combine(workingDirectory, StderrLogFileName);
        await using var stdoutLog = new StreamWriter(
            new FileStream(stdoutPath, FileMode.Create, FileAccess.Write, FileShare.Read)
        )
        {
            AutoFlush = true,
        };
        await using var stderrLog = new StreamWriter(
            new FileStream(stderrPath, FileMode.Create, FileAccess.Write, FileShare.Read)
        )
        {
            AutoFlush = true,
        };

        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        var stdoutLock = new object();
        var stderrLock = new object();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is null)
            {
                return;
            }

            lock (stdoutLock)
            {
                stdoutLog.WriteLine(e.Data);
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
                stderrLog.WriteLine(e.Data);
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
            timeoutCts.Token
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
            var timedOut = hasTimeout && timeoutCts.IsCancellationRequested && !cancellationToken.IsCancellationRequested;
            try
            {
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }
            }
            catch
            {
                // ignored
            }

            try
            {
                await process.WaitForExitAsync(CancellationToken.None).ConfigureAwait(false);
            }
            catch
            {
                // ignored — best effort so the slot is not released over a live child
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
        finally
        {
            process.Dispose();
        }
    }

    static string FormatTimeout(TimeSpan timeout) =>
        timeout.TotalHours >= 1 && timeout.Minutes == 0 && timeout.Seconds == 0
            ? $"{timeout.TotalHours:0}h"
            : timeout.ToString();
}
