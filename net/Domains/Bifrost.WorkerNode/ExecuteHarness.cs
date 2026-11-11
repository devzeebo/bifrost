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
    public const string BifrostNodeImage = "bifrost/node";

    public static async Task Handle(
        ExecuteHarness command,
        IBifrostBus bus,
        WorkerNodeIdentity identity,
        IHarnessAcceptStore accepts,
        IHarnessRunGate runs,
        HarnessExecutionSlot slot,
        IHarnessProcessRunner runner,
        IOptions<HarnessHostOptions> harnessOptions,
        IOptions<DockerHostOptions> dockerOptions,
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

        using var runGate = runs.Begin(command.RunId, cancellationToken, out var runToken);
        var actor = WorkItemLifecycleActors.ForWorker(identity.Id);

        if (state is HarnessAcceptState.Running)
        {
            var recovery = await DecideRecovery(bus, identity.Id, command).ConfigureAwait(false);
            switch (recovery)
            {
                case RecoveryAction.Skip:
                    accepts.MarkConcluded(command.WorkItemId, command.RunId);
                    return;
                case RecoveryAction.FailInterrupted:
                    await Fail(
                            bus,
                            command,
                            actor,
                            "harness ended without a clean exit after the item was already running",
                            runToken
                        )
                        .ConfigureAwait(false);
                    accepts.MarkConcluded(command.WorkItemId, command.RunId);
                    return;
                case RecoveryAction.ResumeAsFirstAttempt:
                    // Start never landed; continue into the normal execution path.
                    break;
            }
        }
        else if (!accepts.TryBeginRunning(command.WorkItemId, command.RunId))
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
                    runToken
                )
                .ConfigureAwait(false);

            var opts = harnessOptions.Value;
            var workspace = PrepareWorkspace(opts.WorkingDirectory, command.RunId);
            var script = TryReadScriptWorkload(workItem.Data);

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
                    runToken
                )
                .ConfigureAwait(false);

            string? processExecutable = null;
            IReadOnlyList<string>? processArguments = null;
            var startReason = "harness started";
            var metadataReason = "record harness and workspace";
            var runMetadata = new JsonObject
            {
                ["harness"] = opts.Identity,
                ["workspace"] = workspace,
                ["specFingerprint"] = Fingerprint(workItem.Data),
            };

            if (script is not null)
            {
                if (string.IsNullOrWhiteSpace(script.Body))
                {
                    await Fail(
                            bus,
                            command,
                            actor,
                            "script failed to start: body is missing",
                            runToken,
                            expectedItemStatus: TrackedWorkItemStatuses.Claimed
                        )
                        .ConfigureAwait(false);
                    accepts.MarkConcluded(command.WorkItemId, command.RunId);
                    return;
                }

                var image = string.IsNullOrWhiteSpace(script.Image)
                    ? BifrostNodeImage
                    : script.Image.Trim();
                if (image != BifrostNodeImage)
                {
                    await Fail(
                            bus,
                            command,
                            actor,
                            $"script failed to start: image '{image}' is not supported",
                            runToken,
                            expectedItemStatus: TrackedWorkItemStatuses.Claimed
                        )
                        .ConfigureAwait(false);
                    accepts.MarkConcluded(command.WorkItemId, command.RunId);
                    return;
                }

                await File.WriteAllTextAsync(
                        Path.Combine(workspace, "body.mjs"),
                        script.Body,
                        runToken
                    )
                    .ConfigureAwait(false);

                var hostRoot = string.IsNullOrWhiteSpace(dockerOptions.Value.HostWorkspaceRoot)
                    ? opts.WorkingDirectory
                    : dockerOptions.Value.HostWorkspaceRoot;
                var hostWorkspace = Path.Combine(hostRoot, command.RunId.ToString("D"));

                processExecutable = "docker";
                processArguments =
                [
                    "run",
                    "--rm",
                    "-v",
                    $"{hostWorkspace}:/workspace",
                    "-w",
                    "/workspace",
                    "-e",
                    "BIFROST_WORKSPACE=/workspace",
                    image,
                ];
                startReason = "script started";
                metadataReason = "record script image and workspace";
                runMetadata = new JsonObject
                {
                    ["image"] = image,
                    ["workspace"] = workspace,
                    ["hostWorkspace"] = hostWorkspace,
                    ["specFingerprint"] = Fingerprint(workItem.Data),
                };
            }

            await bus.Request<StartTrackedWorkItemApi.Command, Unit>(
                    new StartTrackedWorkItemApi.Command
                    {
                        Id = command.WorkItemId,
                        RunId = command.RunId,
                        Actor = actor,
                        Reason = startReason,
                        Expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Claimed },
                    },
                    runToken
                )
                .ConfigureAwait(false);

            await bus.Publish(
                    new ReplaceRunMetadataApi.Command
                    {
                        Id = command.RunId,
                        Actor = actor,
                        Reason = metadataReason,
                        Metadata = runMetadata,
                    },
                    runToken
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
                    runToken,
                    processExecutable,
                    processArguments
                )
                .ConfigureAwait(false);

            if (!await StillHeld(bus, identity.Id, command).ConfigureAwait(false))
            {
                accepts.MarkConcluded(command.WorkItemId, command.RunId);
                return;
            }

            if (!await RunStillOpen(bus, command).ConfigureAwait(false))
            {
                // Attempt closed under us (death release) — do not report a late outcome.
                accepts.MarkConcluded(command.WorkItemId, command.RunId);
                return;
            }

            await ReportOutcome(bus, command, actor, result, runToken).ConfigureAwait(false);
            accepts.MarkConcluded(command.WorkItemId, command.RunId);
        }
        catch (OperationCanceledException)
            when (runToken.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            // Kill directive canceled this run only — conclude so we do not report.
            accepts.MarkConcluded(command.WorkItemId, command.RunId);
        }
        catch
        {
            // Host/parent cancellation or other failure: leave Accepted/Running so
            // durable redelivery can resume or recover.
            throw;
        }
    }

    enum RecoveryAction
    {
        Skip,
        FailInterrupted,
        ResumeAsFirstAttempt,
    }

    static async Task<RecoveryAction> DecideRecovery(
        IBifrostBus bus,
        Guid workerId,
        ExecuteHarness command
    )
    {
        if (!await RunStillOpen(bus, command).ConfigureAwait(false))
        {
            return RecoveryAction.Skip;
        }

        GetTrackedWorkItemApi.Response item;
        try
        {
            item = await bus.Request<GetTrackedWorkItemApi.Query, GetTrackedWorkItemApi.Response>(
                    new GetTrackedWorkItemApi.Query { Id = command.WorkItemId }
                )
                .ConfigureAwait(false);
        }
        catch (BusException)
        {
            throw;
        }

        if (item.HolderId != workerId)
        {
            return RecoveryAction.Skip;
        }

        return item.Status switch
        {
            TrackedWorkItemStatuses.Claimed => RecoveryAction.ResumeAsFirstAttempt,
            TrackedWorkItemStatuses.Running => RecoveryAction.FailInterrupted,
            _ => RecoveryAction.Skip,
        };
    }

    sealed record ScriptWorkload(string Image, string Body);

    static ScriptWorkload? TryReadScriptWorkload(JsonNode data)
    {
        if (data is not JsonObject root)
        {
            return null;
        }

        if (
            !root.TryGetPropertyValue("node", out var nodeNode)
            || nodeNode is not JsonObject node
        )
        {
            return null;
        }

        if (
            !node.TryGetPropertyValue("style", out var styleNode)
            || styleNode is null
            || styleNode.GetValueKind() != JsonValueKind.String
            || !string.Equals(
                styleNode.GetValue<string>(),
                "script",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            return null;
        }

        if (
            !node.TryGetPropertyValue("spec", out var specNode)
            || specNode is not JsonObject spec
        )
        {
            return new ScriptWorkload(BifrostNodeImage, "");
        }

        var image =
            spec.TryGetPropertyValue("image", out var imageNode)
            && imageNode is not null
            && imageNode.GetValueKind() == JsonValueKind.String
                ? imageNode.GetValue<string>()
                : BifrostNodeImage;

        var body =
            spec.TryGetPropertyValue("body", out var bodyNode)
            && bodyNode is not null
            && bodyNode.GetValueKind() == JsonValueKind.String
                ? bodyNode.GetValue<string>()
                : "";

        return new ScriptWorkload(image, body);
    }

    static string PrepareWorkspace(string baseDirectory, Guid runId)
    {
        var root = string.IsNullOrWhiteSpace(baseDirectory) ? "workspaces" : baseDirectory;
        var workspace = Path.GetFullPath(Path.Combine(root, runId.ToString("D")));
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
        CancellationToken cancellationToken,
        string expectedItemStatus = TrackedWorkItemStatuses.Running
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
                    Expected = new JsonObject { ["status"] = expectedItemStatus },
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
