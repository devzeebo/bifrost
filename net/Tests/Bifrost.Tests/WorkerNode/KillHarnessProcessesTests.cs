using Bifrost.Orchestrator.Contracts;
using Bifrost.WorkerNode;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class KillHarnessProcessesTests
{
    [Fact]
    public async Task cancel_targets_only_the_named_run()
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        using var accepts = new HarnessAcceptStore(db);
        var gate = new HarnessRunGate();

        var deadWork = Guid.NewGuid();
        var deadRun = Guid.NewGuid();
        var liveWork = Guid.NewGuid();
        var liveRun = Guid.NewGuid();
        accepts.TryAccept(deadWork, deadRun).ShouldBeTrue();
        accepts.TryBeginRunning(deadWork, deadRun).ShouldBeTrue();
        accepts.TryAccept(liveWork, liveRun).ShouldBeTrue();
        accepts.TryBeginRunning(liveWork, liveRun).ShouldBeTrue();

        using var live = gate.Begin(liveRun, CancellationToken.None, out var liveToken);
        using var dead = gate.Begin(deadRun, CancellationToken.None, out var deadToken);

        await KillHarnessProcessesHandler.Handle(
            new KillHarnessProcessesApi.Command
            {
                WorkerId = identity.Id,
                WorkItemId = deadWork,
                RunId = deadRun,
            },
            identity,
            accepts,
            gate
        );

        deadToken.IsCancellationRequested.ShouldBeTrue();
        liveToken.IsCancellationRequested.ShouldBeFalse();
        accepts.GetState(deadWork, deadRun).ShouldBe(HarnessAcceptState.Concluded);
        accepts.GetState(liveWork, liveRun).ShouldBe(HarnessAcceptState.Running);
    }

    [Fact]
    public async Task unknown_run_is_a_noop()
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        using var accepts = new HarnessAcceptStore(db);
        var gate = new HarnessRunGate();

        await KillHarnessProcessesHandler.Handle(
            new KillHarnessProcessesApi.Command
            {
                WorkerId = identity.Id,
                WorkItemId = Guid.NewGuid(),
                RunId = Guid.NewGuid(),
            },
            identity,
            accepts,
            gate
        );
    }

    [Fact]
    public async Task wrong_worker_is_ignored()
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        using var accepts = new HarnessAcceptStore(db);
        var gate = new HarnessRunGate();
        var work = Guid.NewGuid();
        var run = Guid.NewGuid();
        accepts.TryAccept(work, run).ShouldBeTrue();

        await KillHarnessProcessesHandler.Handle(
            new KillHarnessProcessesApi.Command
            {
                WorkerId = Guid.NewGuid(),
                WorkItemId = work,
                RunId = run,
            },
            identity,
            accepts,
            gate
        );

        accepts.GetState(work, run).ShouldBe(HarnessAcceptState.Accepted);
    }
}
