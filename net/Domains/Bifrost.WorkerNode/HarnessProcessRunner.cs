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
    const int MaxCapturedChars = 64 * 1024;

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

        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        process.OutputDataReceived += (_, e) => AppendBounded(stdout, e.Data);
        process.ErrorDataReceived += (_, e) => AppendBounded(stderr, e.Data);
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        try
        {
            await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
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

            return new HarnessProcessResult
            {
                Started = true,
                ExitCode = process.HasExited ? process.ExitCode : null,
                StandardOutput = stdout.ToString(),
                StandardError = stderr.ToString(),
                StartError = process.HasExited
                    ? null
                    : "harness ended without a clean exit",
            };
        }
        finally
        {
            process.Dispose();
        }
    }

    static void AppendBounded(StringBuilder buffer, string? line)
    {
        if (line is null)
        {
            return;
        }

        if (buffer.Length >= MaxCapturedChars)
        {
            return;
        }

        var remaining = MaxCapturedChars - buffer.Length;
        if (line.Length + 1 > remaining)
        {
            buffer.Append(line.AsSpan(0, Math.Max(0, remaining - 1)));
            return;
        }

        buffer.AppendLine(line);
    }
}
