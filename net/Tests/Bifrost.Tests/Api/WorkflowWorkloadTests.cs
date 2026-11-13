extern alias Orchestrator;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Tests.Support;
using Bifrost.WorkItems.Contracts;
using Bifrost.Workflows.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using NodeExecutionRelationship = Orchestrator::Bifrost.TrackedWorkItems.Workflow.NodeExecutionRelationship;

namespace Bifrost.Tests.Api;

[CollectionDefinition("orchestrator-workflow-workload")]
public sealed class OrchestratorWorkflowWorkloadCollection
    : ICollectionFixture<OrchestratorApiFactory>;

[Collection("orchestrator-workflow-workload")]
public class WorkflowWorkloadTests
{
    readonly OrchestratorApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public WorkflowWorkloadTests(OrchestratorApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task unattached_item_stays_pending_for_worker_claim()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);

        (await Post(client, "/create-tracked-work-item", Body(id, "accept")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Pending);
    }

    [Fact]
    public async Task attached_linear_workflow_drafts_first_node_and_succeeds_root()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var (rootId, firstNodeId, secondNodeId, _) = SeedLinearWorkflow();

        (await Post(client, "/create-tracked-work-item", Body(rootId, "run workflow")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await WaitFor(
            async () => (await Get(client, rootId)).Status == TrackedWorkItemStatuses.Executing,
            "root executing"
        );

        var firstExecution = await WaitForNodeExecution(rootId, firstNodeId);
        firstExecution
            .Ledger.Metadata[WorkItemInputDefaults.MetadataRootWorkItemIdKey]!
            .GetValue<string>()
            .ShouldBe(rootId.ToString("D"));
        firstExecution.Tracked.Status.ShouldBeOneOf(
            TrackedWorkItemStatuses.Pending,
            TrackedWorkItemStatuses.Claimed
        );
        AssertNodeExecutionRelationship(rootId, firstExecution.Ledger.Id);

        await ClaimStartSucceed(client, firstExecution.Ledger.Id, workerId, "first done");

        var secondExecution = await WaitForNodeExecution(rootId, secondNodeId);
        AssertNodeExecutionRelationship(rootId, secondExecution.Ledger.Id);
        await ClaimStartSucceed(client, secondExecution.Ledger.Id, workerId, "second done");

        await WaitFor(
            async () => (await Get(client, rootId)).Status == TrackedWorkItemStatuses.Succeeded,
            "root succeeded"
        );
        _factory.WorkItemLedger.StatusOf(rootId).ShouldBe(TrackedWorkItemStatuses.Succeeded);
    }

    [Fact]
    public async Task create_fails_when_get_work_item_classification_fails()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);
        _factory.WorkItemLedger.FailNextGet(id);

        var response = await Post(client, "/create-tracked-work-item", Body(id, "accept"));
        response.StatusCode.ShouldNotBe(HttpStatusCode.NoContent);

        _factory.WorkItemLedger.ClearGetFailure(id);
        (await GetOrNull(client, id)).ShouldBeNull();
    }

    [Fact]
    public async Task unreachable_leftover_nodes_fail_the_root()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var workflowId = Guid.NewGuid();
        var input = WorkItemInputDefaults.CreateNode();
        var reachable = Runnable("reachable", x: 200);
        var orphan = Runnable("orphan", x: 200, y: 120);
        _factory.WorkflowCatalog.Seed(
            new GetWorkflowApi.Response
            {
                Id = workflowId,
                Name = "orphan-graph",
                Version = 1,
                Nodes = [input, reachable, orphan],
                Connections =
                [
                    new WorkflowConnection
                    {
                        Id = Guid.NewGuid(),
                        OutputPortId = input.Outputs[0].Id,
                        InputPortId = reachable.Inputs[0].Id,
                    },
                ],
            }
        );

        var rootId = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(
            rootId,
            data: new JsonObject { ["title"] = "feature" },
            metadata: WorkItemInputDefaults.AttachmentMetadata(workflowId)
        );

        (await Post(client, "/create-tracked-work-item", Body(rootId, "run")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var execution = await WaitForNodeExecution(rootId, reachable.Id);
        await ClaimStartSucceed(client, execution.Ledger.Id, workerId, "reachable done");

        await WaitFor(
            async () => (await Get(client, rootId)).Status == TrackedWorkItemStatuses.Failed,
            "root failed for unreachable"
        );
        _factory
            .WorkItemLedger.HistoryOf(rootId)
            .Last()
            .Reason.ShouldContain("unreachable nodes");
        _factory.WorkItemLedger.HistoryOf(rootId).Last().Reason.ShouldContain("orphan");
    }

    [Fact]
    public async Task hold_twice_in_one_run_mirrors_with_distinct_keys()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var (rootId, firstNodeId, _, _) = SeedLinearWorkflow();

        (await Post(client, "/create-tracked-work-item", Body(rootId, "run")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var firstExecution = await WaitForNodeExecution(rootId, firstNodeId);

        await EnsureClaimed(client, firstExecution.Ledger.Id, workerId);
        var held = await Get(client, firstExecution.Ledger.Id);
        var holder = held.HolderId ?? workerId;
        var runId = await LatestRunId(client, firstExecution.Ledger.Id);
        if (held.Status == TrackedWorkItemStatuses.Claimed)
        {
            (
                await Post(
                    client,
                    "/start-tracked-work-item",
                    ReportBody(firstExecution.Ledger.Id, runId, holder, "start")
                )
            ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (
            await Post(
                client,
                "/hold-tracked-work-item",
                ReportBody(firstExecution.Ledger.Id, runId, holder, "first hold")
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await Post(
                client,
                "/resume-tracked-work-item",
                ReportBody(firstExecution.Ledger.Id, runId, holder, "resume")
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await Post(
                client,
                "/hold-tracked-work-item",
                ReportBody(firstExecution.Ledger.Id, runId, holder, "second hold")
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var keys = _factory.WorkItemLedger.AppliedRequestKeysOf(firstExecution.Ledger.Id);
        keys.ShouldContain(k => k.Contains(":hold:", StringComparison.Ordinal) && k.EndsWith(":hold-1"));
        keys.ShouldContain(k => k.Contains(":hold:", StringComparison.Ordinal) && k.EndsWith(":hold-2"));
        _factory
            .WorkItemLedger.HistoryOf(firstExecution.Ledger.Id)
            .Count(h => h.Status == TrackedWorkItemStatuses.NeedsAttention)
            .ShouldBe(2);
    }

    [Fact]
    public async Task node_failure_ends_root_and_skips_later_nodes()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var (rootId, firstNodeId, secondNodeId, _) = SeedLinearWorkflow();

        (await Post(client, "/create-tracked-work-item", Body(rootId, "run workflow")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var firstExecution = await WaitForNodeExecution(rootId, firstNodeId);

        await ClaimStartFail(client, firstExecution.Ledger.Id, workerId, "boom");

        await WaitFor(
            async () => (await Get(client, rootId)).Status == TrackedWorkItemStatuses.Failed,
            "root failed"
        );
        _factory
            .WorkItemLedger.HistoryOf(rootId)
            .Last()
            .Reason.ShouldContain("ended in failed");

        var listed = _factory.WorkItemLedger.List(
            new ListWorkItemsApi.Query
            {
                Metadata = new JsonObject
                {
                    [WorkItemInputDefaults.MetadataRootWorkItemIdKey] = rootId.ToString("D"),
                },
            }
        );
        listed.Items.ShouldNotContain(i =>
            i.Id != firstExecution.Ledger.Id
            && _factory.WorkItemLedger.Get(i.Id).Metadata[
                WorkItemInputDefaults.MetadataNodeIdKey
            ]!.GetValue<string>() == secondNodeId.ToString("D")
        );
    }

    [Fact]
    public async Task input_schema_mismatch_fails_root_without_drafting_nodes()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        var input = WorkItemInputDefaults.CreateNode(
            inputSchema: new JsonObject
            {
                ["type"] = "object",
                ["required"] = new JsonArray("title"),
                ["properties"] = new JsonObject
                {
                    ["title"] = new JsonObject { ["type"] = "string" },
                },
            }
        );
        var node = new WorkflowNode
        {
            Id = Guid.NewGuid(),
            Name = "only",
            Position = new NodePosition { X = 200, Y = 40 },
            Inputs =
            [
                new WorkflowPort
                {
                    Id = Guid.NewGuid(),
                    Name = "in",
                    Schema = new JsonObject { ["type"] = "object" },
                },
            ],
            Outputs =
            [
                new WorkflowPort
                {
                    Id = Guid.NewGuid(),
                    Name = "out",
                    Schema = new JsonObject { ["type"] = "object" },
                },
            ],
            Definition = new NodeDefinition
            {
                Style = DefinitionStyle.Harness,
                Spec = new JsonObject { ["identity"] = "agent" },
            },
        };
        _factory.WorkflowCatalog.Seed(
            new GetWorkflowApi.Response
            {
                Id = workflowId,
                Name = "strict",
                Version = 1,
                Nodes = [input, node],
                Connections =
                [
                    new WorkflowConnection
                    {
                        Id = Guid.NewGuid(),
                        OutputPortId = input.Outputs[0].Id,
                        InputPortId = node.Inputs[0].Id,
                    },
                ],
            }
        );

        var rootId = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(
            rootId,
            data: new JsonObject { ["other"] = "nope" },
            metadata: WorkItemInputDefaults.AttachmentMetadata(workflowId)
        );

        (await Post(client, "/create-tracked-work-item", Body(rootId, "run")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await WaitFor(
            async () => (await Get(client, rootId)).Status == TrackedWorkItemStatuses.Failed,
            "root failed on schema"
        );
        _factory
            .WorkItemLedger.HistoryOf(rootId)
            .Last()
            .Reason.ShouldContain("does not satisfy");
        _factory
            .WorkItemLedger.List(
                new ListWorkItemsApi.Query
                {
                    Metadata = new JsonObject
                    {
                        [WorkItemInputDefaults.MetadataRootWorkItemIdKey] = rootId.ToString("D"),
                    },
                }
            )
            .Items.ShouldBeEmpty();
    }

    [Fact]
    public async Task missing_workflow_fails_root_at_start()
    {
        var client = _factory.CreateClient();
        var rootId = Guid.NewGuid();
        var missingWorkflow = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(
            rootId,
            metadata: WorkItemInputDefaults.AttachmentMetadata(missingWorkflow)
        );

        (await Post(client, "/create-tracked-work-item", Body(rootId, "run")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await WaitFor(
            async () => (await Get(client, rootId)).Status == TrackedWorkItemStatuses.Failed,
            "root failed missing workflow"
        );
        _factory
            .WorkItemLedger.HistoryOf(rootId)
            .Last()
            .Reason.ShouldContain("no longer resolves");
    }

    [Fact]
    public async Task snapshot_survives_workflow_edit()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var (rootId, firstNodeId, secondNodeId, workflowId) = SeedLinearWorkflow(
            firstName: "alpha",
            secondName: "beta"
        );

        (await Post(client, "/create-tracked-work-item", Body(rootId, "run")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var firstExecution = await WaitForNodeExecution(rootId, firstNodeId);

        var editedSecond = new WorkflowNode
        {
            Id = secondNodeId,
            Name = "beta-edited",
            Position = new NodePosition { X = 400, Y = 40 },
            Inputs =
            [
                new WorkflowPort
                {
                    Id = Guid.NewGuid(),
                    Name = "in",
                    Schema = new JsonObject { ["type"] = "object" },
                },
            ],
            Outputs =
            [
                new WorkflowPort
                {
                    Id = Guid.NewGuid(),
                    Name = "out",
                    Schema = new JsonObject { ["type"] = "object" },
                },
            ],
            Definition = new NodeDefinition
            {
                Style = DefinitionStyle.Script,
                Spec = new JsonObject
                {
                    ["image"] = "bifrost/node",
                    ["body"] = "export default {}",
                },
            },
        };
        var current = _factory.WorkflowCatalog.Get(workflowId);
        _factory.WorkflowCatalog.Seed(
            current with
            {
                Version = current.Version + 1,
                Nodes =
                [
                    current.Nodes[0],
                    current.Nodes[1] with
                    {
                        Name = "alpha-edited",
                    },
                    editedSecond,
                ],
            }
        );

        await ClaimStartSucceed(client, firstExecution.Ledger.Id, workerId, "first");
        var secondExecution = await WaitForNodeExecution(rootId, secondNodeId);
        secondExecution
            .Ledger.Metadata[WorkItemInputDefaults.MetadataNodeNameKey]!
            .GetValue<string>()
            .ShouldBe("beta");
    }

    [Fact]
    public async Task fan_out_issues_successors_one_at_a_time_in_node_order()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var workflowId = Guid.NewGuid();
        var input = WorkItemInputDefaults.CreateNode();
        var left = Runnable("left", x: 200);
        var right = Runnable("right", x: 200, y: 120);
        _factory.WorkflowCatalog.Seed(
            new GetWorkflowApi.Response
            {
                Id = workflowId,
                Name = "fan",
                Version = 1,
                Nodes = [input, left, right],
                Connections =
                [
                    new WorkflowConnection
                    {
                        Id = Guid.NewGuid(),
                        OutputPortId = input.Outputs[0].Id,
                        InputPortId = left.Inputs[0].Id,
                    },
                    new WorkflowConnection
                    {
                        Id = Guid.NewGuid(),
                        OutputPortId = input.Outputs[0].Id,
                        InputPortId = right.Inputs[0].Id,
                    },
                ],
            }
        );

        var rootId = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(
            rootId,
            data: new JsonObject { ["title"] = "fan" },
            metadata: WorkItemInputDefaults.AttachmentMetadata(workflowId)
        );

        (await Post(client, "/create-tracked-work-item", Body(rootId, "run")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var first = await WaitForNodeExecution(rootId, left.Id);
        await WaitFor(
            async () =>
                _factory
                    .WorkItemLedger.List(
                        new ListWorkItemsApi.Query
                        {
                            Metadata = new JsonObject
                            {
                                [WorkItemInputDefaults.MetadataRootWorkItemIdKey] =
                                    rootId.ToString("D"),
                            },
                        }
                    )
                    .Items.Count == 1,
            "only left drafted"
        );

        await ClaimStartSucceed(client, first.Ledger.Id, workerId, "left done");
        var second = await WaitForNodeExecution(rootId, right.Id);
        second.Ledger.Id.ShouldNotBe(first.Ledger.Id);
    }

    [Fact]
    public async Task needs_attention_on_node_leaves_root_executing()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var (rootId, firstNodeId, _, _) = SeedLinearWorkflow();

        (await Post(client, "/create-tracked-work-item", Body(rootId, "run")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var firstExecution = await WaitForNodeExecution(rootId, firstNodeId);

        await EnsureClaimed(client, firstExecution.Ledger.Id, workerId);
        var held = await Get(client, firstExecution.Ledger.Id);
        var holder = held.HolderId ?? workerId;
        var runId = await LatestRunId(client, firstExecution.Ledger.Id);
        if (held.Status == TrackedWorkItemStatuses.Claimed)
        {
            (
                await Post(
                    client,
                    "/start-tracked-work-item",
                    ReportBody(firstExecution.Ledger.Id, runId, holder, "start")
                )
            ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (
            await Post(
                client,
                "/hold-tracked-work-item",
                ReportBody(firstExecution.Ledger.Id, runId, holder, "need person")
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await Get(client, firstExecution.Ledger.Id)).Status.ShouldBe(
            TrackedWorkItemStatuses.NeedsAttention
        );
        (await Get(client, rootId)).Status.ShouldBe(TrackedWorkItemStatuses.Executing);

        (
            await Post(
                client,
                "/resume-tracked-work-item",
                ReportBody(firstExecution.Ledger.Id, runId, holder, "answered")
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Get(client, firstExecution.Ledger.Id)).Status.ShouldBe(
            TrackedWorkItemStatuses.Running
        );
    }

    (Guid RootId, Guid FirstNodeId, Guid SecondNodeId, Guid WorkflowId) SeedLinearWorkflow(
        string firstName = "first",
        string secondName = "second"
    )
    {
        var workflowId = Guid.NewGuid();
        var input = WorkItemInputDefaults.CreateNode();
        var first = Runnable(firstName, x: 200);
        var second = Runnable(secondName, x: 400);
        _factory.WorkflowCatalog.Seed(
            new GetWorkflowApi.Response
            {
                Id = workflowId,
                Name = "linear",
                Version = 3,
                Nodes = [input, first, second],
                Connections =
                [
                    new WorkflowConnection
                    {
                        Id = Guid.NewGuid(),
                        OutputPortId = input.Outputs[0].Id,
                        InputPortId = first.Inputs[0].Id,
                    },
                    new WorkflowConnection
                    {
                        Id = Guid.NewGuid(),
                        OutputPortId = first.Outputs[0].Id,
                        InputPortId = second.Inputs[0].Id,
                    },
                ],
            }
        );

        var rootId = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(
            rootId,
            data: new JsonObject { ["title"] = "feature" },
            metadata: WorkItemInputDefaults.AttachmentMetadata(workflowId)
        );
        return (rootId, first.Id, second.Id, workflowId);
    }

    static WorkflowNode Runnable(string name, double x = 200, double y = 40) =>
        new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Position = new NodePosition { X = x, Y = y },
            Inputs =
            [
                new WorkflowPort
                {
                    Id = Guid.NewGuid(),
                    Name = "in",
                    Schema = new JsonObject { ["type"] = "object" },
                },
            ],
            Outputs =
            [
                new WorkflowPort
                {
                    Id = Guid.NewGuid(),
                    Name = "out",
                    Schema = new JsonObject { ["type"] = "object" },
                },
            ],
            Definition = new NodeDefinition
            {
                Style = DefinitionStyle.Harness,
                Spec = new JsonObject { ["identity"] = "agent" },
            },
        };

    async Task<(
        GetWorkItemApi.Response Ledger,
        GetTrackedWorkItemApi.Response Tracked
    )> WaitForNodeExecution(Guid rootId, Guid nodeId)
    {
        GetWorkItemApi.Response? ledger = null;
        GetTrackedWorkItemApi.Response? tracked = null;
        var client = _factory.CreateClient();
        await WaitFor(
            async () =>
            {
                var listed = _factory.WorkItemLedger.List(
                    new ListWorkItemsApi.Query
                    {
                        Metadata = new JsonObject
                        {
                            [WorkItemInputDefaults.MetadataRootWorkItemIdKey] =
                                rootId.ToString("D"),
                            [WorkItemInputDefaults.MetadataNodeIdKey] = nodeId.ToString("D"),
                        },
                    }
                );
                if (listed.Items.Count == 0)
                {
                    return false;
                }

                try
                {
                    ledger = _factory.WorkItemLedger.Get(listed.Items[0].Id);
                    tracked = await Get(client, listed.Items[0].Id);
                    return true;
                }
                catch
                {
                    return false;
                }
            },
            $"node {nodeId} drafted"
        );

        return (ledger!, tracked!);
    }

    void AssertNodeExecutionRelationship(Guid rootId, Guid nodeWorkItemId)
    {
        var root = _factory.WorkItemLedger.Get(rootId);
        var node = _factory.WorkItemLedger.Get(nodeWorkItemId);
        root.Relationships.ShouldContain(r =>
            r.RelatedWorkItemId == nodeWorkItemId
            && r.RelationshipTypeId == NodeExecutionRelationship.TypeId
        );
        node.Relationships.ShouldContain(r =>
            r.RelatedWorkItemId == rootId
            && r.RelationshipTypeId == NodeExecutionRelationship.TypeId
        );
    }

    static async Task<GetTrackedWorkItemApi.Response?> GetOrNull(HttpClient client, Guid id)
    {
        var request = new HttpRequestMessage(
            new HttpMethod("QUERY"),
            $"/get-tracked-work-item/{id}"
        )
        {
            Content = JsonContent.Create(new { }),
        };
        var response = await client.SendAsync(request);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }

        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        return await response.Content.ReadFromJsonAsync<GetTrackedWorkItemApi.Response>(JsonOptions);
    }

    async Task EnsureClaimed(HttpClient client, Guid id, Guid workerId)
    {
        await WaitFor(
            async () =>
            {
                var current = await Get(client, id);
                if (
                    current.Status
                    is TrackedWorkItemStatuses.Claimed
                        or TrackedWorkItemStatuses.Running
                        or TrackedWorkItemStatuses.NeedsAttention
                )
                {
                    return true;
                }

                if (current.Status != TrackedWorkItemStatuses.Pending)
                {
                    throw new InvalidOperationException(
                        $"Expected claimable status for {id}, was {current.Status}."
                    );
                }

                var claim = await Post(
                    client,
                    "/claim-tracked-work-item",
                    Body(id, "dispatch", workerId)
                );
                return claim.StatusCode == HttpStatusCode.NoContent;
            },
            $"claim {id}"
        );
    }

    async Task ClaimStartSucceed(HttpClient client, Guid id, Guid workerId, string reason)
    {
        await EnsureClaimed(client, id, workerId);
        var item = await Get(client, id);
        var holder = item.HolderId ?? workerId;
        var runId = await LatestRunId(client, id);
        if (item.Status == TrackedWorkItemStatuses.Claimed)
        {
            (
                await Post(
                    client,
                    "/start-tracked-work-item",
                    ReportBody(id, runId, holder, "start")
                )
            ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (
            await Post(client, "/succeed-tracked-work-item", ReportBody(id, runId, holder, reason))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    async Task ClaimStartFail(HttpClient client, Guid id, Guid workerId, string reason)
    {
        await EnsureClaimed(client, id, workerId);
        var item = await Get(client, id);
        var holder = item.HolderId ?? workerId;
        var runId = await LatestRunId(client, id);
        if (item.Status == TrackedWorkItemStatuses.Claimed)
        {
            (
                await Post(
                    client,
                    "/start-tracked-work-item",
                    ReportBody(id, runId, holder, "start")
                )
            ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        (
            await Post(client, "/fail-tracked-work-item", ReportBody(id, runId, holder, reason))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    async Task<Guid> RegisterWorker()
    {
        var id = Guid.NewGuid();
        var bus = _factory.Services.GetRequiredService<IBifrostBus>();
        await bus.Publish(new WorkerNodeRegistered.Command { Id = id });
        return id;
    }

    static object Body(Guid id, string reason, Guid? workerId = null) =>
        workerId is null
            ? new
            {
                id,
                actor = WorkItemLifecycleActors.Orchestrator,
                reason,
            }
            : new
            {
                id,
                workerId,
                actor = WorkItemLifecycleActors.Orchestrator,
                reason,
            };

    static object ReportBody(Guid id, Guid runId, Guid workerId, string reason) =>
        new
        {
            id,
            runId,
            actor = WorkItemLifecycleActors.ForWorker(workerId),
            reason,
        };

    static async Task<HttpResponseMessage> Post(HttpClient client, string path, object body)
    {
        return await client.PostAsJsonAsync(path, body, JsonOptions);
    }

    static async Task<GetTrackedWorkItemApi.Response> Get(HttpClient client, Guid id)
    {
        var request = new HttpRequestMessage(
            new HttpMethod("QUERY"),
            $"/get-tracked-work-item/{id}"
        )
        {
            Content = JsonContent.Create(new { }),
        };
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return (
            await response.Content.ReadFromJsonAsync<GetTrackedWorkItemApi.Response>(JsonOptions)
        )!;
    }

    static async Task<Guid> LatestRunId(HttpClient client, Guid workItemId)
    {
        Guid? runId = null;
        await WaitFor(
            async () =>
            {
                var request = new HttpRequestMessage(
                    new HttpMethod("QUERY"),
                    "/list-runs-for-work-item"
                )
                {
                    Content = JsonContent.Create(new { workItemId }),
                };
                var response = await client.SendAsync(request);
                response.EnsureSuccessStatusCode();
                var body = await response.Content.ReadFromJsonAsync<ListRunsForWorkItemApi.Response>(
                    JsonOptions
                );
                if (body is null || body.Items.Count == 0)
                {
                    return false;
                }

                runId = body.Items.OrderByDescending(i => i.Position).First().Id;
                return true;
            },
            "run created"
        );
        return runId!.Value;
    }

    static async Task WaitFor(Func<Task<bool>> condition, string label)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (DateTime.UtcNow < deadline)
        {
            if (await condition())
            {
                return;
            }

            await Task.Delay(50);
        }

        throw new TimeoutException($"Timed out waiting for {label}.");
    }
}
