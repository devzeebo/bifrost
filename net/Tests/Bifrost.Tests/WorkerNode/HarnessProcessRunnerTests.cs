using System.Diagnostics;
using Bifrost.WorkerNode;
using Microsoft.Extensions.Options;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class HarnessProcessRunnerTests
{
    [Fact]
    public async Task timeout_kills_descendant_process()
    {
        var workspace = Path.Combine(Path.GetTempPath(), $"harness-timeout-{Guid.NewGuid():N}");
        Directory.CreateDirectory(workspace);
        var scriptPath = Path.Combine(workspace, "run.sh");
        var pidPath = Path.Combine(workspace, "child.pid");
        await File.WriteAllTextAsync(
            scriptPath,
            """
            #!/bin/sh
            sleep 120 &
            echo $! > child.pid
            wait
            """
        );

        var runner = new HarnessProcessRunner(
            Options.Create(
                new HarnessHostOptions
                {
                    Executable = "/bin/sh",
                    Arguments = [scriptPath],
                    ExecutionTimeout = TimeSpan.FromMilliseconds(400),
                    WorkingDirectory = workspace,
                }
            )
        );

        var result = await runner.Run(
            workspace,
            new Dictionary<string, string>(),
            CancellationToken.None
        );

        result.TimedOut.ShouldBeTrue();
        result.StartError.ShouldNotBeNull().ShouldContain("ceiling");

        var pidText = await File.ReadAllTextAsync(pidPath);
        var pid = int.Parse(pidText.Trim());
        await WaitUntilProcessGone(pid, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task log_open_failure_does_not_start_process()
    {
        var missing = Path.Combine(Path.GetTempPath(), $"missing-ws-{Guid.NewGuid():N}", "nested");
        var runner = new HarnessProcessRunner(
            Options.Create(
                new HarnessHostOptions
                {
                    Executable = "/bin/true",
                    Arguments = [],
                    WorkingDirectory = missing,
                }
            )
        );

        var result = await runner.Run(
            missing,
            new Dictionary<string, string>(),
            CancellationToken.None
        );

        result.Started.ShouldBeFalse();
        result.StartError.ShouldNotBeNull().ShouldContain("could not open log files");
    }

    static async Task WaitUntilProcessGone(int pid, TimeSpan budget)
    {
        var deadline = DateTime.UtcNow + budget;
        while (DateTime.UtcNow < deadline)
        {
            if (!ProcessExists(pid))
            {
                return;
            }

            await Task.Delay(50);
        }

        ProcessExists(pid).ShouldBeFalse($"descendant pid {pid} was still alive after timeout");
    }

    static bool ProcessExists(int pid)
    {
        try
        {
            using var process = Process.GetProcessById(pid);
            return !process.HasExited;
        }
        catch (ArgumentException)
        {
            return false;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }
}
