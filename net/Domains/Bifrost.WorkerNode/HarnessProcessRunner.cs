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
        CancellationToken cancellationToken
    );
}

public sealed class HarnessProcessRunner(IOptions<HarnessHostOptions> options) : IHarnessProcessRunner
{
    public async Task<HarnessProcessResult> Run(
        string workingDirectory,
        IReadOnlyDictionary<string, string> extraEnvironment,
        CancellationToken cancellationToken
    )
    {
        var opts = options.Value;
        if (string.IsNullOrWhiteSpace(opts.Executable))
        {
            return new HarnessProcessResult
            {
                Started = false,
                StartError = "harness failed to start: Executable is not configured",
            };
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = opts.Executable,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            WorkingDirectory = workingDirectory,
        };

        foreach (var arg in opts.Arguments)
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
                    $"Failed to start harness process '{opts.Executable}'."
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
        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                stdout.AppendLine(e.Data);
            }
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is not null)
            {
                stderr.AppendLine(e.Data);
            }
        };
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

            return new HarnessProcessResult
            {
                Started = true,
                ExitCode = null,
                StandardOutput = stdout.ToString(),
                StandardError = stderr.ToString(),
                StartError = "harness ended without a clean exit",
            };
        }
        finally
        {
            process.Dispose();
        }
    }
}
