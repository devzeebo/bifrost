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
        ISkillDocumentCache skills,
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
            var style = script is not null ? "script" : "harness";

            var skillPlaceError = await PlaceSkills(
                    bus,
                    skills,
                    workItem.Data,
                    workspace,
                    runToken
                )
                .ConfigureAwait(false);
            if (skillPlaceError is not null)
            {
                await Fail(
                        bus,
                        command,
                        actor,
                        skillPlaceError,
                        runToken,
                        expectedItemStatus: TrackedWorkItemStatuses.Claimed
                    )
                    .ConfigureAwait(false);
                accepts.MarkConcluded(command.WorkItemId, command.RunId);
                return;
            }

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
                            CannotStartReason(
                                style,
                                asked: "image 'bifrost/node' with script body",
                                found: "body is missing",
                                runtime: null
                            ),
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
                            CannotStartReason(
                                style,
                                asked: $"image '{image}' with script body",
                                found: $"image '{image}' is not supported; expected '{BifrostNodeImage}'",
                                runtime: null
                            ),
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
                    "--name",
                    DockerContainerName.ForRun(command.RunId),
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
                accepts.MarkConcluded(command.WorkItemId, command.RunId);
                return;
            }

            await ReportOutcome(
                    bus,
                    command,
                    actor,
                    result,
                    style,
                    script,
                    opts,
                    workspace,
                    workItem.Data,
                    runToken
                )
                .ConfigureAwait(false);
            accepts.MarkConcluded(command.WorkItemId, command.RunId);
        }
        catch (OperationCanceledException)
            when (runToken.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            accepts.MarkConcluded(command.WorkItemId, command.RunId);
        }
        catch
        {
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

    static async Task<string?> PlaceSkills(
        IBifrostBus bus,
        ISkillDocumentCache skills,
        JsonNode data,
        string workspace,
        CancellationToken cancellationToken
    )
    {
        IReadOnlyList<SkillRef> refs;
        try
        {
            refs = SkillRefReader.ReadFromNodeSpec(data);
        }
        catch (Exception ex)
        {
            return $"failed to place skill documents: {ex.Message}";
        }

        var documents = new List<SkillDocument>(refs.Count);
        foreach (var skillRef in refs)
        {
            try
            {
                documents.Add(
                    await skills.Get(skillRef, bus, cancellationToken).ConfigureAwait(false)
                );
            }
            catch (Exception ex)
            {
                var versionPart = skillRef.SkillVersionId is { } v
                    ? $" version '{v:D}'"
                    : "";
                return $"failed to place skill documents: capability '{skillRef.CapabilityId:D}'{versionPart}: {ex.Message}";
            }
        }

        var versionByCapability = new Dictionary<Guid, Guid>();
        foreach (var document in documents)
        {
            if (
                versionByCapability.TryGetValue(document.CapabilityId, out var existing)
                && existing != document.VersionId
            )
            {
                return $"failed to place skill documents: capability '{document.CapabilityId:D}' has conflicting skill versions '{existing:D}' and '{document.VersionId:D}'";
            }

            versionByCapability[document.CapabilityId] = document.VersionId;
        }

        foreach (var document in documents)
        {
            var dir = Path.Combine(workspace, "skills", document.CapabilityId.ToString("D"));
            try
            {
                Directory.CreateDirectory(dir);
                await File.WriteAllTextAsync(
                        Path.Combine(dir, "SKILL.md"),
                        document.Markdown,
                        cancellationToken
                    )
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                return $"failed to place skill documents: could not write skill '{document.CapabilityId:D}': {ex.Message}";
            }
        }

        return null;
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
        string style,
        ScriptWorkload? script,
        HarnessHostOptions opts,
        string workspace,
        JsonNode issuedData,
        CancellationToken cancellationToken
    )
    {
        if (result.TimedOut)
        {
            await Fail(
                    bus,
                    command,
                    actor,
                    result.StartError
                        ?? "execution exceeded the configured ceiling",
                    cancellationToken
                )
                .ConfigureAwait(false);
            return;
        }

        if (!result.Started)
        {
            var asked =
                style == "script"
                    ? $"image '{script?.Image ?? BifrostNodeImage}' with script body"
                    : $"harness '{opts.Identity}' command '{opts.Executable ?? "(none)"}'";
            await Fail(
                    bus,
                    command,
                    actor,
                    CannotStartReason(
                        style,
                        asked,
                        found: "process did not start",
                        runtime: result.StartError
                    ),
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
                    CannotStartReason(
                        style,
                        asked: style == "script"
                            ? $"image '{script?.Image ?? BifrostNodeImage}'"
                            : $"harness '{opts.Identity}'",
                        found: "process ended without a clean exit",
                        runtime: result.StartError
                    ),
                    cancellationToken
                )
                .ConfigureAwait(false);
            return;
        }

        if (result.ExitCode != 0)
        {
            await Fail(
                    bus,
                    command,
                    actor,
                    $"{style} exited {result.ExitCode}",
                    cancellationToken
                )
                .ConfigureAwait(false);
            return;
        }

        var ports = OutputPortValidation.ReadPortsFromIssuedData(issuedData);
        var outputsPath = Path.Combine(workspace, OutputPortValidation.OutputsFileName);
        JsonNode? returned = null;
        if (File.Exists(outputsPath))
        {
            try
            {
                var text = await File.ReadAllTextAsync(outputsPath, cancellationToken)
                    .ConfigureAwait(false);
                returned = string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text);
            }
            catch (Exception ex)
            {
                await Fail(
                        bus,
                        command,
                        actor,
                        $"{style} exited 0 but outputs.json could not be read: {ex.Message}",
                        cancellationToken
                    )
                    .ConfigureAwait(false);
                return;
            }
        }
        else if (ports.Count > 0)
        {
            var first = ports[0].Name;
            await Fail(
                    bus,
                    command,
                    actor,
                    $"output port '{first}' was not filled by the return",
                    cancellationToken
                )
                .ConfigureAwait(false);
            return;
        }

        if (
            !OutputPortValidation.TryMapAndValidate(
                returned,
                ports,
                out var mapped,
                out var portFailure
            )
        )
        {
            await Fail(bus, command, actor, portFailure ?? "output ports were not satisfied", cancellationToken)
                .ConfigureAwait(false);
            return;
        }

        if (ports.Count > 0)
        {
            var succeededData = OutputPortValidation.BuildSucceededData(issuedData, mapped);
            try
            {
                await bus.Request<ReplaceWorkItemDataApi.Command, Unit>(
                        new ReplaceWorkItemDataApi.Command
                        {
                            Id = command.WorkItemId,
                            Data = succeededData,
                            Actor = actor,
                            Reason = "record node execution return",
                            Expected = new JsonObject { ["data"] = issuedData.DeepClone() },
                        },
                        cancellationToken
                    )
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                await Fail(
                        bus,
                        command,
                        actor,
                        $"failed to record node execution return: {ex.Message}",
                        cancellationToken
                    )
                    .ConfigureAwait(false);
                return;
            }
        }

        await bus.Publish(
                new SucceedRunApi.Command
                {
                    Id = command.RunId,
                    Actor = actor,
                    Reason = $"{style} exited 0",
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
                    Reason = $"{style} exited 0",
                    Expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Running },
                },
                cancellationToken
            )
            .ConfigureAwait(false);
    }

    static string CannotStartReason(
        string style,
        string asked,
        string found,
        string? runtime
    )
    {
        var reason = $"{style} failed to start: asked {asked}; found {found}";
        if (!string.IsNullOrWhiteSpace(runtime))
        {
            reason = $"{reason}; runtime: {runtime}";
        }

        return reason;
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
