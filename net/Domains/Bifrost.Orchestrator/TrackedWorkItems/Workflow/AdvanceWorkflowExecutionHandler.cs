using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.TrackedWorkItems.Projections;
using Bifrost.Workflows.Contracts;
using Bifrost.WorkItems.Contracts;
using Marten;
using Wolverine;

namespace Bifrost.TrackedWorkItems.Workflow;

public static class AdvanceWorkflowExecutionHandler
{
    public static async Task Handle(
        AdvanceWorkflowExecution message,
        IQuerySession session,
        IBifrostBus bus,
        IMessageBus local
    )
    {
        var root =
            await session.LoadAsync<TrackedWorkItemView.Model>(message.RootWorkItemId)
            ?? throw new CommandValidationException(
                $"Tracked work item {message.RootWorkItemId} was not found."
            );

        if (
            root.Status
            is TrackedWorkItemStatuses.Succeeded
                or TrackedWorkItemStatuses.Failed
                or TrackedWorkItemStatuses.Canceled
        )
        {
            return;
        }

        var beganExecuting = false;
        GetWorkItemApi.Response ledger;
        try
        {
            ledger = await bus.Request<GetWorkItemApi.Query, GetWorkItemApi.Response>(
                new GetWorkItemApi.Query { Id = message.RootWorkItemId }
            );
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.NotFound)
        {
            await FailRoot(
                    local,
                    session,
                    message.RootWorkItemId,
                    $"Attached work item {message.RootWorkItemId} was not found on the ledger."
                )
                .ConfigureAwait(false);
            return;
        }

        var snapshot = WorkflowSnapshot.TryRead(ledger.Metadata);
        if (snapshot is null)
        {
            if (
                !WorkItemInputDefaults.TryReadAttachedWorkflowId(
                    ledger.Metadata,
                    out var workflowId
                )
            )
            {
                return;
            }

            GetWorkflowApi.Response workflow;
            try
            {
                workflow = await bus.Request<GetWorkflowApi.Query, GetWorkflowApi.Response>(
                    new GetWorkflowApi.Query { Id = workflowId }
                );
            }
            catch (BusException ex)
                when (ex.Error.Code is BusErrorCodes.NotFound or BusErrorCodes.Validation)
            {
                await FailRoot(
                        local,
                        session,
                        message.RootWorkItemId,
                        $"Workflow {workflowId} no longer resolves; cannot start the attached work item."
                    )
                    .ConfigureAwait(false);
                return;
            }

            snapshot = WorkflowSnapshot.FromResponse(workflow);
            var workItemInput = WorkflowGraphNavigation.RequireWorkItemInput(snapshot);
            var inputSchema = WorkflowGraphNavigation.RequireInputSchema(workItemInput);
            if (
                !WorkflowInputSchema.TryEvaluate(
                    ledger.Data,
                    inputSchema,
                    out var schemaDetail
                )
            )
            {
                var detail = string.IsNullOrWhiteSpace(schemaDetail)
                    ? "instance does not satisfy schema"
                    : schemaDetail;
                await FailRoot(
                        local,
                        session,
                        message.RootWorkItemId,
                        $"Work item data does not satisfy workflow '{snapshot.Name}' input schema: {detail}"
                    )
                    .ConfigureAwait(false);
                return;
            }

            var metadata = ledger.Metadata.DeepClone().AsObject();
            metadata[WorkItemInputDefaults.MetadataWorkflowSnapshotKey] = snapshot.ToJson();
            metadata[WorkItemInputDefaults.MetadataWorkflowVersionKey] = snapshot.Version;

            await bus.Request<ReplaceWorkItemMetadataApi.Command, Unit>(
                    new ReplaceWorkItemMetadataApi.Command
                    {
                        Id = message.RootWorkItemId,
                        Metadata = metadata,
                        Actor = WorkItemLifecycleActors.Orchestrator,
                        Reason = "snapshot workflow shape at start",
                    }
                )
                .ConfigureAwait(false);

            if (root.Status == TrackedWorkItemStatuses.Pending)
            {
                await local
                    .InvokeAsync(
                        new BeginExecutingTrackedWorkItemApi.Command
                        {
                            Id = message.RootWorkItemId,
                            Actor = WorkItemLifecycleActors.Orchestrator,
                            Reason = "begin attached workflow execution",
                            Expected = new JsonObject
                            {
                                ["status"] = TrackedWorkItemStatuses.Pending,
                            },
                        }
                    )
                    .ConfigureAwait(false);
                beganExecuting = true;
            }

            ledger = await bus.Request<GetWorkItemApi.Query, GetWorkItemApi.Response>(
                new GetWorkItemApi.Query { Id = message.RootWorkItemId }
            );
            snapshot = WorkflowSnapshot.TryRead(ledger.Metadata) ?? snapshot;
        }
        else if (root.Status == TrackedWorkItemStatuses.Pending)
        {
            await local
                .InvokeAsync(
                    new BeginExecutingTrackedWorkItemApi.Command
                    {
                        Id = message.RootWorkItemId,
                        Actor = WorkItemLifecycleActors.Orchestrator,
                        Reason = "begin attached workflow execution",
                        Expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Pending },
                    }
                )
                .ConfigureAwait(false);
            beganExecuting = true;
        }

        if (!beganExecuting)
        {
            root =
                await session.LoadAsync<TrackedWorkItemView.Model>(message.RootWorkItemId) ?? root;
            if (root.Status != TrackedWorkItemStatuses.Executing)
            {
                return;
            }
        }

        var executions = await LoadNodeExecutions(bus, session, message.RootWorkItemId)
            .ConfigureAwait(false);
        if (HasInFlight(executions))
        {
            return;
        }

        var failed = executions.FirstOrDefault(e =>
            e.Tracked.Status
                is TrackedWorkItemStatuses.Failed
                    or TrackedWorkItemStatuses.Canceled
        );
        if (failed is not null)
        {
            var nodeLabel =
                failed.Ledger.Metadata[WorkItemInputDefaults.MetadataNodeNameKey]
                    ?.GetValue<string>()
                ?? failed.Ledger.Metadata[WorkItemInputDefaults.MetadataNodeIdKey]
                    ?.GetValue<string>()
                ?? failed.Ledger.Id.ToString("D");
            var ending = failed.Tracked.Status;
            if (ending == TrackedWorkItemStatuses.Failed)
            {
                await FailRoot(
                        local,
                        session,
                        message.RootWorkItemId,
                        $"Node '{nodeLabel}' ended in {ending}."
                    )
                    .ConfigureAwait(false);
            }
            else
            {
                await local
                    .InvokeAsync(
                        new CancelTrackedWorkItemApi.Command
                        {
                            Id = message.RootWorkItemId,
                            Actor = WorkItemLifecycleActors.Orchestrator,
                            Reason = $"Node '{nodeLabel}' ended in {ending}.",
                            Expected = new JsonObject
                            {
                                ["status"] = TrackedWorkItemStatuses.Executing,
                            },
                        }
                    )
                    .ConfigureAwait(false);
            }

            return;
        }

        var concludedOutputs = await BuildConcludedOutputs(bus, snapshot, ledger, executions)
            .ConfigureAwait(false);
        var issuedNodeIds = executions
            .Select(e =>
            {
                var raw = e.Ledger.Metadata[WorkItemInputDefaults.MetadataNodeIdKey]
                    ?.GetValue<string>();
                return Guid.TryParse(raw, out var id) ? id : Guid.Empty;
            })
            .Where(id => id != Guid.Empty)
            .ToHashSet();

        var ready = WorkflowGraphNavigation.ReadyNodes(snapshot, issuedNodeIds, concludedOutputs);
        if (ready.Count == 0)
        {
            if (issuedNodeIds.Count == 0)
            {
                await FailRoot(
                        local,
                        session,
                        message.RootWorkItemId,
                        $"Workflow '{snapshot.Name}' has no runnable node after the work-item input."
                    )
                    .ConfigureAwait(false);
                return;
            }

            var unissued = snapshot
                .Nodes.Where(n =>
                    !WorkItemInputDefaults.IsWorkItemInput(n) && !issuedNodeIds.Contains(n.Id)
                )
                .Select(n => string.IsNullOrWhiteSpace(n.Name) ? n.Id.ToString("D") : n.Name)
                .ToArray();
            if (unissued.Length > 0)
            {
                await FailRoot(
                        local,
                        session,
                        message.RootWorkItemId,
                        $"Workflow '{snapshot.Name}' finished with unreachable nodes: {string.Join(", ", unissued)}."
                    )
                    .ConfigureAwait(false);
                return;
            }

            await local
                .InvokeAsync(
                    new SucceedExecutingTrackedWorkItemApi.Command
                    {
                        Id = message.RootWorkItemId,
                        Actor = WorkItemLifecycleActors.Orchestrator,
                        Reason = "workflow nodes concluded",
                        Expected = new JsonObject
                        {
                            ["status"] = TrackedWorkItemStatuses.Executing,
                        },
                    }
                )
                .ConfigureAwait(false);
            return;
        }

        var next = ready[0];
        await DraftAndScheduleNode(
                bus,
                local,
                message.RootWorkItemId,
                snapshot,
                next,
                WorkflowGraphNavigation.BuildIssuedInputs(next, snapshot, concludedOutputs)
            )
            .ConfigureAwait(false);
    }

    static async Task FailRoot(
        IMessageBus local,
        IQuerySession session,
        Guid rootId,
        string reason
    )
    {
        var tracked = await session.LoadAsync<TrackedWorkItemView.Model>(rootId);
        if (tracked is null)
        {
            return;
        }

        if (tracked.Status == TrackedWorkItemStatuses.Pending)
        {
            await local.InvokeAsync(
                new BeginExecutingTrackedWorkItemApi.Command
                {
                    Id = rootId,
                    Actor = WorkItemLifecycleActors.Orchestrator,
                    Reason = "begin attached workflow execution before recording start failure",
                    Expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Pending },
                }
            );
        }
        else if (tracked.Status != TrackedWorkItemStatuses.Executing)
        {
            return;
        }

        // Aggregate handlers reload from the event stream, so BeginExecuting is visible here
        // even if this query session's projection row is still stale.
        await local.InvokeAsync(
            new FailExecutingTrackedWorkItemApi.Command
            {
                Id = rootId,
                Actor = WorkItemLifecycleActors.Orchestrator,
                Reason = reason,
                Expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Executing },
            }
        );
    }

    static async Task DraftAndScheduleNode(
        IBifrostBus bus,
        IMessageBus local,
        Guid rootWorkItemId,
        WorkflowSnapshot snapshot,
        WorkflowNode node,
        JsonObject issuedInputs
    )
    {
        await EnsureRelationshipType(bus).ConfigureAwait(false);

        var nodeWorkItemId = Guid.NewGuid();
        var data = WorkflowGraphNavigation.BuildNodeWorkItemData(node, issuedInputs);
        var metadata = new JsonObject
        {
            [WorkItemInputDefaults.MetadataWorkflowIdKey] = snapshot.Id.ToString("D"),
            [WorkItemInputDefaults.MetadataRootWorkItemIdKey] = rootWorkItemId.ToString("D"),
            [WorkItemInputDefaults.MetadataNodeIdKey] = node.Id.ToString("D"),
            [WorkItemInputDefaults.MetadataNodeNameKey] = node.Name,
            [WorkItemInputDefaults.MetadataIssuedInputsKey] = issuedInputs.DeepClone(),
        };

        await bus.Request<CreateWorkItemApi.Command, Unit>(
                new CreateWorkItemApi.Command
                {
                    Id = nodeWorkItemId,
                    Data = data,
                    Status = TrackedWorkItemStatuses.Pending,
                    Metadata = metadata,
                    Actor = WorkItemLifecycleActors.Orchestrator,
                    Reason = $"draft node execution '{node.Name}'",
                }
            )
            .ConfigureAwait(false);

        await bus.Request<AddRelationshipApi.Command, Unit>(
                new AddRelationshipApi.Command
                {
                    WorkItemId = nodeWorkItemId,
                    Word = NodeExecutionRelationship.ForwardWord,
                    RelatedWorkItemId = rootWorkItemId,
                    Actor = WorkItemLifecycleActors.Orchestrator,
                    Reason = "link node execution to attached work item",
                }
            )
            .ConfigureAwait(false);

        await local
            .InvokeAsync(
                new CreateTrackedWorkItemApi.Command
                {
                    Id = nodeWorkItemId,
                    Actor = WorkItemLifecycleActors.Orchestrator,
                    Reason = $"schedule node execution '{node.Name}'",
                }
            )
            .ConfigureAwait(false);
    }

    static async Task EnsureRelationshipType(IBifrostBus bus)
    {
        var listed = await bus.Request<
            ListRelationshipTypesApi.Query,
            ListRelationshipTypesApi.Response
        >(new ListRelationshipTypesApi.Query());

        if (
            listed.Items.Any(i =>
                i.IsActive
                && string.Equals(
                    i.ForwardWord,
                    NodeExecutionRelationship.ForwardWord,
                    StringComparison.Ordinal
                )
            )
        )
        {
            return;
        }

        try
        {
            await bus.Request<DefineRelationshipTypeApi.Command, Unit>(
                new DefineRelationshipTypeApi.Command
                {
                    Id = NodeExecutionRelationship.TypeId,
                    ForwardWord = NodeExecutionRelationship.ForwardWord,
                    InverseWord = NodeExecutionRelationship.InverseWord,
                }
            );
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.Validation)
        {
            // Race: another advance defined it first.
        }
    }

    static async Task<IReadOnlyList<NodeExecution>> LoadNodeExecutions(
        IBifrostBus bus,
        IQuerySession session,
        Guid rootWorkItemId
    )
    {
        var listed = await bus.Request<ListWorkItemsApi.Query, ListWorkItemsApi.Response>(
            new ListWorkItemsApi.Query
            {
                Metadata = new JsonObject
                {
                    [WorkItemInputDefaults.MetadataRootWorkItemIdKey] =
                        rootWorkItemId.ToString("D"),
                },
            }
        );

        var results = new List<NodeExecution>();
        foreach (var item in listed.Items.Where(i => !i.IsDeleted))
        {
            var ledger = await bus.Request<GetWorkItemApi.Query, GetWorkItemApi.Response>(
                new GetWorkItemApi.Query { Id = item.Id }
            );
            var tracked = await session.LoadAsync<TrackedWorkItemView.Model>(item.Id);
            if (tracked is null)
            {
                continue;
            }

            results.Add(
                new NodeExecution(
                    ledger,
                    new GetTrackedWorkItemApi.Response
                    {
                        Id = tracked.Id,
                        Status = tracked.Status,
                        HolderId = tracked.HolderId,
                    }
                )
            );
        }

        return results
            .OrderBy(e =>
                e.Ledger.Metadata[WorkItemInputDefaults.MetadataNodeNameKey]?.GetValue<string>()
                ?? e.Ledger.Id.ToString("D")
            )
            .ToList();
    }

    static bool HasInFlight(IReadOnlyList<NodeExecution> executions) =>
        executions.Any(e =>
            e.Tracked.Status
                is TrackedWorkItemStatuses.Pending
                    or TrackedWorkItemStatuses.Claimed
                    or TrackedWorkItemStatuses.Running
                    or TrackedWorkItemStatuses.NeedsAttention
        );

    static async Task<Dictionary<Guid, JsonNode?>> BuildConcludedOutputs(
        IBifrostBus bus,
        WorkflowSnapshot snapshot,
        GetWorkItemApi.Response rootLedger,
        IReadOnlyList<NodeExecution> executions
    )
    {
        var outputs = new Dictionary<Guid, JsonNode?>();
        var workItemInput = WorkflowGraphNavigation.RequireWorkItemInput(snapshot);
        foreach (var port in workItemInput.Outputs)
        {
            outputs[port.Id] = rootLedger.Data.DeepClone();
        }

        foreach (
            var execution in executions.Where(e =>
                e.Tracked.Status == TrackedWorkItemStatuses.Succeeded
            )
        )
        {
            var nodeIdRaw = execution
                .Ledger.Metadata[WorkItemInputDefaults.MetadataNodeIdKey]
                ?.GetValue<string>();
            if (!Guid.TryParse(nodeIdRaw, out var nodeId))
            {
                continue;
            }

            var node = snapshot.Nodes.FirstOrDefault(n => n.Id == nodeId);
            if (node is null)
            {
                continue;
            }

            JsonObject produced;
            if (
                execution.Ledger.Metadata.TryGetPropertyValue(
                    WorkItemInputDefaults.MetadataProducedOutputsKey,
                    out var existing
                ) && existing is JsonObject existingObj
            )
            {
                produced = existingObj;
            }
            else
            {
                produced = WorkflowGraphNavigation.RecordProducedOutputs(
                    node,
                    execution.Ledger.Data
                );
                var metadata = execution.Ledger.Metadata.DeepClone().AsObject();
                metadata[WorkItemInputDefaults.MetadataProducedOutputsKey] = produced.DeepClone();
                await bus.Request<ReplaceWorkItemMetadataApi.Command, Unit>(
                    new ReplaceWorkItemMetadataApi.Command
                    {
                        Id = execution.Ledger.Id,
                        Metadata = metadata,
                        Actor = WorkItemLifecycleActors.Orchestrator,
                        Reason = "record produced outputs for workflow advancement",
                    }
                );
            }

            foreach (var port in node.Outputs)
            {
                var key = port.Id.ToString("D");
                outputs[port.Id] = produced.TryGetPropertyValue(key, out var value)
                    ? value?.DeepClone()
                    : null;
            }
        }

        return outputs;
    }

    sealed record NodeExecution(
        GetWorkItemApi.Response Ledger,
        GetTrackedWorkItemApi.Response Tracked
    );
}
