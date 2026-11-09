using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.WorkItems.Contracts;
using Microsoft.Extensions.Options;

namespace Bifrost.WorkerNode;

public sealed record ExecuteHarness
{
    public required Guid WorkItemId { get; init; }
    public required Guid RunId { get; init; }
}

public static class ExecuteHarnessHandler
{
    public static async Task Handle(
        ExecuteHarness command,
        IBifrostBus bus,
        WorkerNodeIdentity identity,
        IHarnessAcceptStore accepts,
        HarnessExecutionSlot slot,
        IHarnessProcessRunner runner,
        IOptions<HarnessHostOptions> harnessOptions,
        CancellationToken cancellationToken
    )
    {
        var state = accepts.GetState(command.WorkItemId, command.RunId);
        if (state is HarnessAcceptState.Concluded or null)
        {
            return;
        }

        await using var _ = await slot.Acquire(cancellationToken).ConfigureAwait(false);

        state = accepts.GetState(command.WorkItemId, command.RunId);
        if (state is HarnessAcceptState.Concluded or null)
        {
            return;
        }

        var actor = WorkItemLifecycleActors.ForWorker(identity.Id);

        if (state is HarnessAcceptState.Running)
        {
            await RecoverInterruptedRun(bus, accepts, command, actor, cancellationToken)
                .ConfigureAwait(false);
            return;
        }

        if (!accepts.TryBeginRunning(command.WorkItemId, command.RunId))
        {
            return;
        }

        try
        {
            if (!await StillHeld(bus, identity.Id, command).ConfigureAwait(false))
            {
                accepts.MarkConcluded(command.WorkItemId, command.RunId);
                return;
            }

            if (!await RunStillOpen(bus, command).ConfigureAwait(false))
            {
                accepts.MarkConcluded(command.WorkItemId, command.RunId);
                return;
            }

            var workItem = await bus.Request<GetWorkItemApi.Query, GetWorkItemApi.Response>(
                    new GetWorkItemApi.Query { Id = command.WorkItemId },
                    cancellationToken
                )
                .ConfigureAwait(false);

            var opts = harnessOptions.Value;
            var workspace = PrepareWorkspace(opts.WorkingDirectory, command.RunId);

            var spec = new JsonObject
            {
                ["workItemId"] = command.WorkItemId.ToString("D"),
                ["runId"] = command.RunId.ToString("D"),
                ["data"] = workItem.Data.DeepClone(),
                ["metadata"] = workItem.Metadata.DeepClone(),
            };
            await File.WriteAllTextAsync(
                    Path.Combine(workspace, "run-spec.json"),
                    spec.ToJsonString(new JsonSerializerOptions { WriteIndented = true }),
                    cancellationToken
                )
                .ConfigureAwait(false);

            await bus.Request<StartTrackedWorkItemApi.Command, Unit>(
                    new StartTrackedWorkItemApi.Command
                    {
                        Id = command.WorkItemId,
                        RunId = command.RunId,
                        Actor = actor,
                        Reason = "harness started",
                        Expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Claimed },
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);

            await bus.Publish(
                    new ReplaceRunMetadataApi.Command
                    {
                        Id = command.RunId,
                        Actor = actor,
                        Reason = "record harness and workspace",
                        Metadata = new JsonObject
                        {
                            ["harness"] = opts.Identity,
                            ["workspace"] = workspace,
                            ["specFingerprint"] = Fingerprint(workItem.Data),
                        },
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);

            if (!await StillHeld(bus, identity.Id, command).ConfigureAwait(false))
            {
                accepts.MarkConcluded(command.WorkItemId, command.RunId);
                return;
            }

            var result = await runner
                .Run(
                    workspace,
                    new Dictionary<string, string>(StringComparer.Ordinal)
                    {
                        ["BIFROST_WORK_ITEM_ID"] = command.WorkItemId.ToString("D"),
                        ["BIFROST_RUN_ID"] = command.RunId.ToString("D"),
                        ["BIFROST_WORKSPACE"] = workspace,
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);

            if (!await StillHeld(bus, identity.Id, command).ConfigureAwait(false))
            {
                accepts.MarkConcluded(command.WorkItemId, command.RunId);
                return;
            }

            await ReportOutcome(bus, command, actor, result, cancellationToken)
                .ConfigureAwait(false);
            accepts.MarkConcluded(command.WorkItemId, command.RunId);
        }
        catch
        {
            // Leave Accepted/Running so durable redelivery can resume or recover.
            throw;
        }
    }

    static async Task RecoverInterruptedRun(
        IBifrostBus bus,
        IHarnessAcceptStore accepts,
        ExecuteHarness command,
        string actor,
        CancellationToken cancellationToken
    )
    {
        if (!await RunStillOpen(bus, command).ConfigureAwait(false))
        {
            accepts.MarkConcluded(command.WorkItemId, command.RunId);
            return;
        }

        if (!await StillHeld(bus, Guid.Parse(actor), command).ConfigureAwait(false))
        {
            accepts.MarkConcluded(command.WorkItemId, command.RunId);
            return;
        }

        await Fail(
                bus,
                command,
                actor,
                "harness ended without a clean exit: worker restarted during execution",
                cancellationToken
            )
            .ConfigureAwait(false);
        accepts.MarkConcluded(command.WorkItemId, command.RunId);
    }

    static string PrepareWorkspace(string baseDirectory, Guid runId)
    {
        var workspace = Path.GetFullPath(Path.Combine(baseDirectory, runId.ToString("D")));
        if (Directory.Exists(workspace))
        {
            Directory.Delete(workspace, recursive: true);
        }

        Directory.CreateDirectory(workspace);
        return workspace;
    }

    static async Task ReportOutcome(
        IBifrostBus bus,
        ExecuteHarness command,
        string actor,
        HarnessProcessResult result,
        CancellationToken cancellationToken
    )
    {
        if (!result.Started)
        {
            await Fail(
                    bus,
                    command,
                    actor,
                    result.StartError ?? "harness failed to start",
                    cancellationToken
                )
                .ConfigureAwait(false);
            return;
        }

        if (result.ExitCode is null)
        {
            await Fail(
                    bus,
                    command,
                    actor,
                    result.StartError ?? "harness ended without a clean exit",
                    cancellationToken
                )
                .ConfigureAwait(false);
            return;
        }

        if (result.ExitCode == 0)
        {
            await bus.Publish(
                    new SucceedRunApi.Command
                    {
                        Id = command.RunId,
                        Actor = actor,
                        Reason = "harness exited 0",
                        Expected = new JsonObject { ["outcome"] = null },
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);
            await bus.Publish(
                    new SucceedTrackedWorkItemApi.Command
                    {
                        Id = command.WorkItemId,
                        RunId = command.RunId,
                        Actor = actor,
                        Reason = "harness exited 0",
                        Expected = new JsonObject
                        {
                            ["status"] = TrackedWorkItemStatuses.Running,
                        },
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);
            return;
        }

        var reason = $"harness exited {result.ExitCode}";
        var stderr = result.StandardError.Trim();
        if (stderr.Length > 0)
        {
            reason = $"{reason}: {(stderr.Length > 500 ? stderr[..500] : stderr)}";
        }

        await Fail(bus, command, actor, reason, cancellationToken).ConfigureAwait(false);
    }

    static async Task Fail(
        IBifrostBus bus,
        ExecuteHarness command,
        string actor,
        string reason,
        CancellationToken cancellationToken
    )
    {
        await bus.Publish(
                new FailRunApi.Command
                {
                    Id = command.RunId,
                    Actor = actor,
                    Reason = reason,
                    Expected = new JsonObject { ["outcome"] = null },
                },
                cancellationToken
            )
            .ConfigureAwait(false);
        await bus.Publish(
                new FailTrackedWorkItemApi.Command
                {
                    Id = command.WorkItemId,
                    RunId = command.RunId,
                    Actor = actor,
                    Reason = reason,
                    Expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Running },
                },
                cancellationToken
            )
            .ConfigureAwait(false);
    }

    static async Task<bool> StillHeld(IBifrostBus bus, Guid workerId, ExecuteHarness command)
    {
        var item = await bus.Request<GetTrackedWorkItemApi.Query, GetTrackedWorkItemApi.Response>(
                new GetTrackedWorkItemApi.Query { Id = command.WorkItemId }
            )
            .ConfigureAwait(false);

        return item.HolderId == workerId
            && item.Status
                is TrackedWorkItemStatuses.Claimed
                    or TrackedWorkItemStatuses.Running;
    }

    static async Task<bool> RunStillOpen(IBifrostBus bus, ExecuteHarness command)
    {
        var run = await bus.Request<GetRunApi.Query, GetRunApi.Response>(
                new GetRunApi.Query { Id = command.RunId }
            )
            .ConfigureAwait(false);

        return run.WorkItemId == command.WorkItemId && run.Outcome is null;
    }

    static string Fingerprint(JsonNode data)
    {
        var bytes = Encoding.UTF8.GetBytes(data.ToJsonString());
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash)[..16].ToLowerInvariant();
    }
}
