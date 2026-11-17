using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.Skills.Contracts;
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
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        ctx.Bus.Requests.OfType<StartTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        ctx.Bus.Published.OfType<SucceedRunApi.Command>().ShouldHaveSingleItem();
        ctx.Bus.Published.OfType<SucceedTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        ctx.Accepts.GetState(ctx.Command.WorkItemId, ctx.Command.RunId)
            .ShouldBe(HarnessAcceptState.Concluded);
    }

    [Fact]
    public async Task exit_nonzero_publishes_fail_with_exit_code_without_log_blob()
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
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        var fail = ctx.Bus.Published.OfType<FailTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        fail.Reason.ShouldContain("exited 3");
        fail.Reason.ShouldNotContain("boom");
    }

    [Fact]
    public async Task start_failure_publishes_fail_with_cannot_start_reason()
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
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        var reason = ctx.Bus.Published.OfType<FailRunApi.Command>().ShouldHaveSingleItem().Reason;
        reason.ShouldContain("harness failed to start");
        reason.ShouldContain("asked");
        reason.ShouldContain("found");
    }

    [Fact]
    public async Task timed_out_fails_naming_ceiling()
    {
        var ctx = Create(
            new HarnessProcessResult
            {
                Started = true,
                TimedOut = true,
                StartError = "execution exceeded the configured ceiling of 1h",
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
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        ctx.Bus.Published.OfType<FailTrackedWorkItemApi.Command>()
            .ShouldHaveSingleItem()
            .Reason.ShouldContain("ceiling");
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
            new FakeSkillCache(),
            options,
            Options.Create(new DockerHostOptions()),
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
            new FakeSkillCache(),
            options,
            Options.Create(new DockerHostOptions()),
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
    public async Task script_node_writes_body_and_runs_docker_image()
    {
        var ctx = Create(new HarnessProcessResult { Started = true, ExitCode = 0 });
        var body = "export const handler = () => ({ outVar: 'Hello World!' });";
        ctx.Bus.SeedWorkItemData(
            ctx.Command.WorkItemId,
            new JsonObject
            {
                ["node"] = new JsonObject
                {
                    ["style"] = "script",
                    ["spec"] = new JsonObject
                    {
                        ["image"] = "bifrost/node",
                        ["body"] = body,
                    },
                },
            }
        );

        var hostRoot = Path.Combine(Path.GetTempPath(), $"host-ws-{Guid.NewGuid():N}");
        var dockerOptions = Options.Create(new DockerHostOptions { HostWorkspaceRoot = hostRoot });

        await ExecuteHarnessHandler.Handle(
            ctx.Command,
            ctx.Bus,
            ctx.Identity,
            ctx.Accepts,
            ctx.Runs,
            ctx.Slot,
            ctx.Runner,
            ctx.Skills,
            ctx.Options,
            dockerOptions,
            CancellationToken.None
        );

        ctx.Runner.LastExecutable.ShouldBe("docker");
        ctx.Runner.LastArguments.ShouldNotBeNull();
        ctx.Runner.LastArguments![0].ShouldBe("run");
        ctx.Runner.LastArguments.ShouldContain("bifrost/node");
        ctx.Runner.LastArguments.ShouldContain("--name");
        ctx.Runner.LastArguments.ShouldContain(DockerContainerName.ForRun(ctx.Command.RunId));
        ctx.Runner.LastArguments.ShouldContain($"{hostRoot}/{ctx.Command.RunId:D}:/workspace");

        var bodyPath = Path.Combine(ctx.Runner.LastWorkingDirectory!, "body.mjs");
        (await File.ReadAllTextAsync(bodyPath)).ShouldBe(body);
        ctx.Bus.Published.OfType<SucceedTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
    }

    [Fact]
    public async Task script_with_no_output_ports_does_not_replace_work_item_data()
    {
        var ctx = Create(
            new HarnessProcessResult { Started = true, ExitCode = 0 },
            writeOutputs: new JsonObject
            {
                ["inputs"] = new JsonObject { ["passthrough"] = true },
            }
        );
        var issued = new JsonObject
        {
            ["node"] = new JsonObject
            {
                ["style"] = "script",
                ["spec"] = new JsonObject
                {
                    ["image"] = "bifrost/node",
                    ["body"] = "export const handler = () => ({ inputs: { passthrough: true } });",
                },
            },
            ["inputs"] = new JsonObject { ["passthrough"] = true },
        };
        ctx.Bus.SeedWorkItemData(ctx.Command.WorkItemId, issued);

        await ExecuteHarnessHandler.Handle(
            ctx.Command,
            ctx.Bus,
            ctx.Identity,
            ctx.Accepts,
            ctx.Runs,
            ctx.Slot,
            ctx.Runner,
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        ctx.Bus.Requests.OfType<ReplaceWorkItemDataApi.Command>().ShouldBeEmpty();
        ctx.Bus.Published.OfType<SucceedTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
    }

    [Fact]
    public async Task script_return_is_validated_and_written_to_work_item()
    {
        var portId = Guid.NewGuid();
        var ctx = Create(
            new HarnessProcessResult { Started = true, ExitCode = 0 },
            writeOutputs: new JsonObject
            {
                ["outputs"] = new JsonObject { ["outVar"] = 4 },
            }
        );
        ctx.Bus.SeedWorkItemData(
            ctx.Command.WorkItemId,
            new JsonObject
            {
                ["node"] = new JsonObject
                {
                    ["style"] = "script",
                    ["spec"] = new JsonObject
                    {
                        ["image"] = "bifrost/node",
                        ["body"] =
                            "export const handler = () => ({ outputs: { outVar: 4 } });",
                    },
                    ["outputs"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["id"] = portId.ToString("D"),
                            ["name"] = "outVar",
                            ["schema"] = new JsonObject { ["type"] = "number" },
                        },
                    },
                },
                ["inputs"] = new JsonObject(),
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
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        var replace = ctx
            .Bus.Requests.OfType<ReplaceWorkItemDataApi.Command>()
            .ShouldHaveSingleItem();
        replace.Data.ShouldNotBeNull();
        replace.Data!["outputs"]![portId.ToString("D")]!.GetValue<int>().ShouldBe(4);
        replace.Expected.ShouldNotBeNull();
        replace.Expected!["data"].ShouldNotBeNull();
        ctx.Bus.Published.OfType<SucceedTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
    }

    [Fact]
    public async Task missing_output_port_fails_naming_the_port()
    {
        var ctx = Create(
            new HarnessProcessResult { Started = true, ExitCode = 0 },
            writeOutputs: new JsonObject
            {
                ["outputs"] = new JsonObject { ["other"] = 1 },
            }
        );
        ctx.Bus.SeedWorkItemData(
            ctx.Command.WorkItemId,
            new JsonObject
            {
                ["node"] = new JsonObject
                {
                    ["style"] = "script",
                    ["spec"] = new JsonObject
                    {
                        ["image"] = "bifrost/node",
                        ["body"] = "export const handler = () => ({ outputs: { other: 1 } });",
                    },
                    ["outputs"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["id"] = Guid.NewGuid().ToString("D"),
                            ["name"] = "needed",
                            ["schema"] = new JsonObject { ["type"] = "number" },
                        },
                    },
                },
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
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        var fail = ctx.Bus.Published.OfType<FailTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        fail.Reason.ShouldContain("needed");
        ctx.Bus.Published.OfType<SucceedTrackedWorkItemApi.Command>().ShouldBeEmpty();
    }

    [Fact]
    public async Task skill_refs_are_materialized_into_workspace()
    {
        var capabilityId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var ctx = Create(new HarnessProcessResult { Started = true, ExitCode = 0 });
        ctx.Skills.Documents[(capabilityId, versionId)] = new SkillDocument(
            capabilityId,
            versionId,
            "# Hello\n"
        );
        ctx.Bus.SeedWorkItemData(
            ctx.Command.WorkItemId,
            new JsonObject
            {
                ["node"] = new JsonObject
                {
                    ["style"] = "harness",
                    ["spec"] = new JsonObject
                    {
                        ["skills"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["capabilityId"] = capabilityId.ToString("D"),
                                ["skillVersionId"] = versionId.ToString("D"),
                            },
                        },
                    },
                },
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
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        var skillPath = Path.Combine(
            ctx.Runner.LastWorkingDirectory!,
            "skills",
            capabilityId.ToString("D"),
            "SKILL.md"
        );
        (await File.ReadAllTextAsync(skillPath)).ShouldBe("# Hello\n");
        ctx.Bus.Published.OfType<SucceedTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
    }

    [Fact]
    public async Task conflicting_skill_versions_fail_before_write()
    {
        var capabilityId = Guid.NewGuid();
        var firstVersion = Guid.NewGuid();
        var secondVersion = Guid.NewGuid();
        var ctx = Create(new HarnessProcessResult { Started = true, ExitCode = 0 });
        ctx.Skills.Documents[(capabilityId, firstVersion)] = new SkillDocument(
            capabilityId,
            firstVersion,
            "# One\n"
        );
        ctx.Skills.Documents[(capabilityId, secondVersion)] = new SkillDocument(
            capabilityId,
            secondVersion,
            "# Two\n"
        );
        ctx.Bus.SeedWorkItemData(
            ctx.Command.WorkItemId,
            new JsonObject
            {
                ["node"] = new JsonObject
                {
                    ["style"] = "harness",
                    ["spec"] = new JsonObject
                    {
                        ["skills"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["capabilityId"] = capabilityId.ToString("D"),
                                ["skillVersionId"] = firstVersion.ToString("D"),
                            },
                            new JsonObject
                            {
                                ["capabilityId"] = capabilityId.ToString("D"),
                                ["skillVersionId"] = secondVersion.ToString("D"),
                            },
                        },
                    },
                },
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
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        var fail = ctx.Bus.Published.OfType<FailTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        fail.Reason.ShouldContain("conflicting skill versions");
        ctx.Runner.Started.ShouldBeFalse();
        var skillDir = Path.Combine(
            ctx.Options.Value.WorkingDirectory,
            ctx.Command.RunId.ToString("D"),
            "skills",
            capabilityId.ToString("D")
        );
        Directory.Exists(skillDir).ShouldBeFalse();
    }

    [Fact]
    public async Task missing_skill_fails_before_start()
    {
        var capabilityId = Guid.NewGuid();
        var ctx = Create(new HarnessProcessResult { Started = true, ExitCode = 0 });
        ctx.Skills.ThrowOnGet = true;
        ctx.Bus.SeedWorkItemData(
            ctx.Command.WorkItemId,
            new JsonObject
            {
                ["node"] = new JsonObject
                {
                    ["style"] = "harness",
                    ["spec"] = new JsonObject
                    {
                        ["skills"] = new JsonArray
                        {
                            new JsonObject { ["capabilityId"] = capabilityId.ToString("D") },
                        },
                    },
                },
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
            ctx.Skills,
            ctx.Options,
            ctx.DockerOptions,
            CancellationToken.None
        );

        ctx.Runner.Started.ShouldBeFalse();
        var fail = ctx.Bus.Published.OfType<FailTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        fail.Reason.ShouldContain("skill");
        fail.Reason.ShouldContain(capabilityId.ToString("D"));
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
            new FakeSkillCache(),
            Options.Create(
                new HarnessHostOptions
                {
                    WorkingDirectory = Path.Combine(Path.GetTempPath(), $"ws-{Guid.NewGuid():N}"),
                }
            ),
            Options.Create(new DockerHostOptions()),
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
            new FakeSkillCache(),
            Options.Create(
                new HarnessHostOptions
                {
                    WorkingDirectory = Path.Combine(Path.GetTempPath(), $"ws-{Guid.NewGuid():N}"),
                }
            ),
            Options.Create(new DockerHostOptions()),
            CancellationToken.None
        );

        started.ShouldBe(0);
        bus.Requests.OfType<StartTrackedWorkItemApi.Command>().ShouldBeEmpty();
        var fail = bus.Published.OfType<FailTrackedWorkItemApi.Command>().ShouldHaveSingleItem();
        fail.Reason.ShouldContain("already running");
        fail.Expected!["status"]!.GetValue<string>().ShouldBe(TrackedWorkItemStatuses.Running);
        accepts.GetState(command.WorkItemId, command.RunId).ShouldBe(HarnessAcceptState.Concluded);
    }

    static TestContext Create(HarnessProcessResult result, JsonNode? writeOutputs = null)
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
            new FixedRunner(result, writeOutputs),
            new FakeSkillCache(),
            Options.Create(
                new HarnessHostOptions
                {
                    Identity = "test-harness",
                    WorkingDirectory = Path.Combine(Path.GetTempPath(), $"ws-{Guid.NewGuid():N}"),
                }
            ),
            Options.Create(new DockerHostOptions())
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
        FakeSkillCache Skills,
        IOptions<HarnessHostOptions> Options,
        IOptions<DockerHostOptions> DockerOptions
    );

    sealed class FakeSkillCache : ISkillDocumentCache
    {
        public Dictionary<(Guid CapabilityId, Guid VersionId), SkillDocument> Documents { get; } =
            new();
        public bool ThrowOnGet { get; set; }

        public Task<SkillDocument> Get(
            SkillRef skillRef,
            IBifrostBus bus,
            CancellationToken cancellationToken
        )
        {
            if (ThrowOnGet)
            {
                throw new InvalidOperationException("skill not found");
            }

            var version = skillRef.SkillVersionId ?? Guid.Empty;
            if (Documents.TryGetValue((skillRef.CapabilityId, version), out var doc))
            {
                return Task.FromResult(doc);
            }

            throw new InvalidOperationException(
                $"skill '{skillRef.CapabilityId:D}' was not seeded in the fake cache"
            );
        }
    }

    sealed class FixedRunner(HarnessProcessResult result, JsonNode? writeOutputs = null)
        : IHarnessProcessRunner
    {
        public Action? OnRun { get; set; }

        public string? LastExecutable { get; private set; }
        public IReadOnlyList<string>? LastArguments { get; private set; }
        public string? LastWorkingDirectory { get; private set; }
        public bool Started { get; private set; }

        public async Task<HarnessProcessResult> Run(
            string workingDirectory,
            IReadOnlyDictionary<string, string> extraEnvironment,
            CancellationToken cancellationToken,
            string? executable = null,
            IReadOnlyList<string>? arguments = null
        )
        {
            LastWorkingDirectory = workingDirectory;
            LastExecutable = executable;
            LastArguments = arguments;
            Started = true;
            OnRun?.Invoke();
            if (writeOutputs is not null)
            {
                await File.WriteAllTextAsync(
                    Path.Combine(workingDirectory, OutputPortValidation.OutputsFileName),
                    writeOutputs.ToJsonString()
                );
            }

            return result;
        }
    }

    sealed class SequencingRunner(TaskCompletionSource gate, List<Guid> order)
        : IHarnessProcessRunner
    {
        public async Task<HarnessProcessResult> Run(
            string workingDirectory,
            IReadOnlyDictionary<string, string> extraEnvironment,
            CancellationToken cancellationToken,
            string? executable = null,
            IReadOnlyList<string>? arguments = null
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
        readonly Dictionary<Guid, JsonObject> _dataByItem = new();

        public void SeedStatus(Guid workItemId, string status) =>
            _statusByItem[workItemId] = status;

        public void SeedWorkItemData(Guid workItemId, JsonObject data) =>
            _dataByItem[workItemId] = data;

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
                    Data = _dataByItem.TryGetValue(q.Id, out var data)
                        ? data.DeepClone()
                        : new JsonObject { ["goal"] = "do it" },
                    Status = "pending",
                    Metadata = new JsonObject(),
                    Relationships = [],
                },
                StartTrackedWorkItemApi.Command start => Start(start),
                ReplaceWorkItemDataApi.Command replace => Replace(replace),
                GetCapabilityApi.Query => throw new NotSupportedException(
                    "use FakeSkillCache in unit tests"
                ),
                GetSkillVersionApi.Query => throw new NotSupportedException(
                    "use FakeSkillCache in unit tests"
                ),
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

        Unit Replace(ReplaceWorkItemDataApi.Command replace)
        {
            if (
                replace.Expected is not null
                && replace.Expected.TryGetPropertyValue("data", out var expectedData)
                && expectedData is not null
            )
            {
                var current = _dataByItem.TryGetValue(replace.Id, out var data)
                    ? data
                    : new JsonObject();
                if (!JsonNode.DeepEquals(expectedData, current))
                {
                    throw new InvalidOperationException(
                        "Work item no longer matches the expected state."
                    );
                }
            }

            _dataByItem[replace.Id] =
                replace.Data as JsonObject ?? new JsonObject { ["value"] = replace.Data.DeepClone() };
            return Unit.Value;
        }
    }
}
