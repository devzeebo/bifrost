using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.WorkerNode;
using Bifrost.WorkItems.Contracts;
using Microsoft.Extensions.Options;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class ExecuteHarnessTests
{
    [Fact]
    public async Task exit_zero_publishes_succeed_run_and_item()
    {
        var ctx = Create(new HarnessProcessResult { Started = true, ExitCode = 0 });

        await ExecuteHarnessHandler.Handle(
            ctx.Command,
            ctx.Bus,
            ctx.Identity,
            ctx.Accepts,
            ctx.Runs,
            ctx.Slot,
            ctx.Runner,
            ctx.Options,
            CancellationToken.None
        );

        ctx.Bus.Requests.OfType<StartTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        ctx.Bus.Published.OfType<SucceedRunApi.Command>().ShouldHaveSingleItem();
        ctx.Bus.Published.OfType<SucceedTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        ctx.Accepts.GetState(ctx.Command.WorkItemId, ctx.Command.RunId)
            .ShouldBe(HarnessAcceptState.Concluded);
    }

    [Fact]
    public async Task exit_nonzero_publishes_fail_with_exit_code()
    {
        var ctx = Create(
            new HarnessProcessResult
            {
                Started = true,
                ExitCode = 3,
                StandardError = "boom",
            }
        );

        await ExecuteHarnessHandler.Handle(
            ctx.Command,
            ctx.Bus,
            ctx.Identity,
            ctx.Accepts,
            ctx.Runs,
            ctx.Slot,
            ctx.Runner,
            ctx.Options,
            CancellationToken.None
        );

        var fail = ctx.Bus.Published.OfType<FailTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        fail.Reason.ShouldContain("exited 3");
        fail.Reason.ShouldContain("boom");
    }

    [Fact]
    public async Task start_failure_publishes_fail_with_machinery_reason()
    {
        var ctx = Create(
            new HarnessProcessResult
            {
                Started = false,
                StartError = "harness failed to start: missing binary",
            }
        );

        await ExecuteHarnessHandler.Handle(
            ctx.Command,
            ctx.Bus,
            ctx.Identity,
            ctx.Accepts,
            ctx.Runs,
            ctx.Slot,
            ctx.Runner,
            ctx.Options,
            CancellationToken.None
        );

        ctx.Bus.Published.OfType<FailRunApi.Command>()
            .ShouldHaveSingleItem()
            .Reason.ShouldContain("harness failed to start");
    }

    [Fact]
    public async Task serial_slot_runs_second_job_after_first()
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        using var accepts = new HarnessAcceptStore(db);
        var slot = new HarnessExecutionSlot();
        var options = Options.Create(
            new HarnessHostOptions
            {
                WorkingDirectory = Path.Combine(Path.GetTempPath(), $"ws-{Guid.NewGuid():N}"),
            }
        );

        var first = new ExecuteHarness { WorkItemId = Guid.NewGuid(), RunId = Guid.NewGuid() };
        var second = new ExecuteHarness { WorkItemId = Guid.NewGuid(), RunId = Guid.NewGuid() };
        accepts.TryAccept(first.WorkItemId, first.RunId).ShouldBeTrue();
        accepts.TryAccept(second.WorkItemId, second.RunId).ShouldBeTrue();

        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var order = new List<Guid>();
        var runner = new SequencingRunner(gate, order);
        var bus = new RecordingBus(
            identity.Id,
            new Dictionary<Guid, Guid>
            {
                [first.RunId] = first.WorkItemId,
                [second.RunId] = second.WorkItemId,
            }
        );

        var firstTask = ExecuteHarnessHandler.Handle(
            first,
            bus,
            identity,
            accepts,
            new HarnessRunGate(),
            slot,
            runner,
            options,
            CancellationToken.None
        );
        await WaitUntil(() => order.Contains(first.RunId));

        var secondTask = ExecuteHarnessHandler.Handle(
            second,
            bus,
            identity,
            accepts,
            new HarnessRunGate(),
            slot,
            runner,
            options,
            CancellationToken.None
        );
        await Task.Delay(50);
        order.ShouldBe([first.RunId]);

        gate.SetResult();
        await Task.WhenAll(firstTask, secondTask);
        order.ShouldBe([first.RunId, second.RunId]);
        bus.Requests.OfType<StartTrackedWorkItemApi.Command>().Count().ShouldBe(2);
    }

    [Fact]
    public async Task interrupted_while_still_claimed_resumes_as_first_attempt()
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        using var accepts = new HarnessAcceptStore(db);
        var command = new ExecuteHarness { WorkItemId = Guid.NewGuid(), RunId = Guid.NewGuid() };
        accepts.TryAccept(command.WorkItemId, command.RunId).ShouldBeTrue();
        accepts.TryBeginRunning(command.WorkItemId, command.RunId).ShouldBeTrue();

        var bus = new RecordingBus(
            identity.Id,
            new Dictionary<Guid, Guid> { [command.RunId] = command.WorkItemId }
        );
        bus.SeedStatus(command.WorkItemId, TrackedWorkItemStatuses.Claimed);
        var runner = new FixedRunner(new HarnessProcessResult { Started = true, ExitCode = 0 });
        var started = 0;
        runner.OnRun = () => Interlocked.Increment(ref started);

        await ExecuteHarnessHandler.Handle(
            command,
            bus,
            identity,
            accepts,
            new HarnessRunGate(),
            new HarnessExecutionSlot(),
            runner,
            Options.Create(
                new HarnessHostOptions
                {
                    WorkingDirectory = Path.Combine(Path.GetTempPath(), $"ws-{Guid.NewGuid():N}"),
                }
            ),
            CancellationToken.None
        );

        started.ShouldBe(1);
        bus.Requests.OfType<StartTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        bus.Published.OfType<FailTrackedWorkItemApi.Command>().ShouldBeEmpty();
        bus.Published.OfType<SucceedTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        accepts.GetState(command.WorkItemId, command.RunId).ShouldBe(HarnessAcceptState.Concluded);
    }

    [Fact]
    public async Task interrupted_after_start_fails_without_starting_process()
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        using var accepts = new HarnessAcceptStore(db);
        var command = new ExecuteHarness { WorkItemId = Guid.NewGuid(), RunId = Guid.NewGuid() };
        accepts.TryAccept(command.WorkItemId, command.RunId).ShouldBeTrue();
        accepts.TryBeginRunning(command.WorkItemId, command.RunId).ShouldBeTrue();

        var bus = new RecordingBus(
            identity.Id,
            new Dictionary<Guid, Guid> { [command.RunId] = command.WorkItemId }
        );
        bus.SeedStatus(command.WorkItemId, TrackedWorkItemStatuses.Running);
        var runner = new FixedRunner(new HarnessProcessResult { Started = true, ExitCode = 0 });
        var started = 0;
        runner.OnRun = () => Interlocked.Increment(ref started);

        await ExecuteHarnessHandler.Handle(
            command,
            bus,
            identity,
            accepts,
            new HarnessRunGate(),
            new HarnessExecutionSlot(),
            runner,
            Options.Create(
                new HarnessHostOptions
                {
                    WorkingDirectory = Path.Combine(Path.GetTempPath(), $"ws-{Guid.NewGuid():N}"),
                }
            ),
            CancellationToken.None
        );

        started.ShouldBe(0);
        bus.Requests.OfType<StartTrackedWorkItemApi.Command>().ShouldBeEmpty();
        var fail = bus.Published.OfType<FailTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        fail.Reason.ShouldContain("already running");
        fail.Expected!["status"]!.GetValue<string>().ShouldBe(TrackedWorkItemStatuses.Running);
        accepts.GetState(command.WorkItemId, command.RunId).ShouldBe(HarnessAcceptState.Concluded);
    }

    static TestContext Create(HarnessProcessResult result)
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        var accepts = new HarnessAcceptStore(db);
        var command = new ExecuteHarness { WorkItemId = Guid.NewGuid(), RunId = Guid.NewGuid() };
        accepts.TryAccept(command.WorkItemId, command.RunId).ShouldBeTrue();
        return new TestContext(
            identity,
            accepts,
            new HarnessRunGate(),
            new HarnessExecutionSlot(),
            command,
            new RecordingBus(
                identity.Id,
                new Dictionary<Guid, Guid> { [command.RunId] = command.WorkItemId }
            ),
            new FixedRunner(result),
            Options.Create(
                new HarnessHostOptions
                {
                    Identity = "test-harness",
                    WorkingDirectory = Path.Combine(Path.GetTempPath(), $"ws-{Guid.NewGuid():N}"),
                }
            )
        );
    }

    static async Task WaitUntil(Func<bool> condition)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (DateTime.UtcNow < deadline)
        {
            if (condition())
            {
                return;
            }

            await Task.Delay(10);
        }

        throw new TimeoutException();
    }

    sealed record TestContext(
        WorkerNodeIdentity Identity,
        HarnessAcceptStore Accepts,
        IHarnessRunGate Runs,
        HarnessExecutionSlot Slot,
        ExecuteHarness Command,
        RecordingBus Bus,
        FixedRunner Runner,
        IOptions<HarnessHostOptions> Options
    );

    sealed class FixedRunner(HarnessProcessResult result) : IHarnessProcessRunner
    {
        public Action? OnRun { get; set; }

        public Task<HarnessProcessResult> Run(
            string workingDirectory,
            IReadOnlyDictionary<string, string> extraEnvironment,
            CancellationToken cancellationToken
        )
        {
            OnRun?.Invoke();
            return Task.FromResult(result);
        }
    }

    sealed class SequencingRunner(TaskCompletionSource gate, List<Guid> order)
        : IHarnessProcessRunner
    {
        public async Task<HarnessProcessResult> Run(
            string workingDirectory,
            IReadOnlyDictionary<string, string> extraEnvironment,
            CancellationToken cancellationToken
        )
        {
            var runId = Guid.Parse(extraEnvironment["BIFROST_RUN_ID"]);
            lock (order)
            {
                order.Add(runId);
            }

            await gate.Task.WaitAsync(cancellationToken);
            return new HarnessProcessResult { Started = true, ExitCode = 0 };
        }
    }

    sealed class RecordingBus(Guid holderId, Dictionary<Guid, Guid> workItemByRun) : IBifrostBus
    {
        public List<object> Requests { get; } = [];
        public List<object> Published { get; } = [];
        readonly Dictionary<Guid, string> _statusByItem = new();

        public void SeedStatus(Guid workItemId, string status) =>
            _statusByItem[workItemId] = status;

        public Task<TResponse> Request<TRequest, TResponse>(
            TRequest request,
            CancellationToken cancellationToken = default
        )
        {
            Requests.Add(request!);
            object response = request switch
            {
                GetTrackedWorkItemApi.Query q => new GetTrackedWorkItemApi.Response
                {
                    Id = q.Id,
                    Status = _statusByItem.GetValueOrDefault(q.Id, TrackedWorkItemStatuses.Claimed),
                    HolderId = holderId,
                },
                GetRunApi.Query q => new GetRunApi.Response
                {
                    Id = q.Id,
                    WorkItemId = workItemByRun[q.Id],
                    Position = 1,
                    CreatedAt = DateTimeOffset.UtcNow,
                    Outcome = null,
                    Data = new JsonObject(),
                    Metadata = new JsonObject(),
                },
                GetWorkItemApi.Query q => new GetWorkItemApi.Response
                {
                    Id = q.Id,
                    Data = new JsonObject { ["goal"] = "do it" },
                    Status = "pending",
                    Metadata = new JsonObject(),
                    Relationships = [],
                },
                StartTrackedWorkItemApi.Command start => Start(start),
                _ => throw new NotSupportedException(request!.GetType().Name),
            };

            return Task.FromResult((TResponse)response);
        }

        public Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
        {
            Published.Add(@event!);
            return Task.CompletedTask;
        }

        Unit Start(StartTrackedWorkItemApi.Command start)
        {
            var current = _statusByItem.GetValueOrDefault(
                start.Id,
                TrackedWorkItemStatuses.Claimed
            );
            if (current != TrackedWorkItemStatuses.Claimed)
            {
                throw new InvalidOperationException(
                    $"Start refused: expected claimed, actual {current}"
                );
            }

            _statusByItem[start.Id] = TrackedWorkItemStatuses.Running;
            return Unit.Value;
        }
    }
}
