extern alias Orchestrator;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Wolverine;
using Wolverine.Runtime.Heartbeat;
using DeclareWorkerOffline = Orchestrator::Bifrost.WorkerNodes.DeclareWorkerOffline;

namespace Bifrost.Tests.Api;

[CollectionDefinition("orchestrator-worker-death")]
public sealed class OrchestratorWorkerDeathCollection
    : ICollectionFixture<OrchestratorApiFactory>;

[Collection("orchestrator-worker-death")]
public class WorkerDeathReleaseTests
{
    readonly OrchestratorApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public WorkerDeathReleaseTests(OrchestratorApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task silence_verdict_releases_held_item_abandons_run_and_sends_kill()
    {
        var client = _factory.CreateClient();
        await BringWorkerOnline();
        await BringWorkerOnline();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);
        _factory.ExecuteClaimedWork.Clear();
        _factory.KillHarnessProcesses.Clear();

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        await WaitFor(
            async () => (await Get(client, id)).Status == TrackedWorkItemStatuses.Claimed,
            "item claimed"
        );
        var holder = (await Get(client, id)).HolderId!.Value;

        await WaitFor(async () => (await ListRuns(client, id)).Count == 1, "run born");
        var deadRunId = (await ListRuns(client, id)).Single().Id;

        await DeclareOffline(holder);

        await WaitFor(
            async () => (await GetWorker(client, holder)).IsOnline == false,
            "holder offline"
        );
        await WaitFor(
            async () =>
                (await ListRuns(client, id)).Single(r => r.Id == deadRunId).Outcome
                == RunOutcome.Abandoned,
            "run abandoned with worker-death"
        );

        await WaitFor(
            () =>
                Task.FromResult(
                    _factory.KillHarnessProcesses.Received.Any(k =>
                        k.WorkerId == holder && k.RunId == deadRunId && k.WorkItemId == id
                    )
                ),
            "kill directive delivered"
        );

        // Item is eligible again — another online worker (or the same after return) may claim it.
        await WaitFor(
            async () =>
            {
                var item = await Get(client, id);
                return item.Status == TrackedWorkItemStatuses.Claimed
                    && item.HolderId != holder;
            },
            "item re-dispatched to a living worker"
        );
    }

    [Fact]
    public async Task late_result_from_dead_attempt_is_rejected()
    {
        var client = _factory.CreateClient();
        await BringWorkerOnline();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        await WaitFor(
            async () => (await Get(client, id)).Status == TrackedWorkItemStatuses.Claimed,
            "claimed"
        );
        var holder = (await Get(client, id)).HolderId!.Value;
        await WaitFor(async () => (await ListRuns(client, id)).Count == 1, "run born");
        var deadRunId = (await ListRuns(client, id)).Single().Id;

        await DeclareOffline(holder);

        await WaitFor(
            async () =>
                (await ListRuns(client, id)).Single(r => r.Id == deadRunId).Outcome
                == RunOutcome.Abandoned,
            "run abandoned"
        );

        var late = await Post(
            client,
            "/succeed-run",
            new
            {
                id = deadRunId,
                actor = WorkItemLifecycleActors.ForWorker(holder),
                reason = "late harness exit",
                expected = new JsonObject { ["outcome"] = null },
            }
        );
        late.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (await ListRuns(client, id)).Single(r => r.Id == deadRunId).Outcome.ShouldBe(
            RunOutcome.Abandoned
        );
    }

    [Fact]
    public async Task heartbeat_after_offline_declares_online_empty_handed()
    {
        var client = _factory.CreateClient();
        await BringWorkerOnline();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        await WaitFor(
            async () => (await Get(client, id)).Status == TrackedWorkItemStatuses.Claimed,
            "claimed"
        );
        var holder = (await Get(client, id)).HolderId!.Value;

        await DeclareOffline(holder);
        await WaitFor(
            async () => !(await GetWorker(client, holder)).IsOnline,
            "offline"
        );
        await WaitFor(
            async () => (await ListHeld(client, holder)).Items.Count == 0,
            "holder empty after release"
        );

        await _factory
            .Services.GetRequiredService<IBifrostBus>()
            .Publish(
                new WolverineHeartbeat(
                    holder.ToString(),
                    1,
                    DateTimeOffset.UtcNow,
                    TimeSpan.Zero
                )
            );

        await WaitFor(
            async () => (await GetWorker(client, holder)).IsOnline,
            "online again"
        );
        // Returning worker takes nothing back — any re-claim is a fresh dispatch win,
        // but immediately after the beat the held set for the death release is empty.
        // Give reclaim a moment; if this worker re-wins, that is allowed and still "clean"
        // relative to the abandoned attempt (new run id).
        var heldAfter = await ListHeld(client, holder);
        if (heldAfter.Items.Count > 0)
        {
            var runs = await ListRuns(client, heldAfter.Items[0].Id);
            runs.ShouldContain(r => r.Outcome == RunOutcome.Abandoned);
            runs.Max(r => r.Position).ShouldBeGreaterThan(1);
        }
    }

    [Fact]
    public async Task silence_verdict_releases_needs_attention_item()
    {
        var client = _factory.CreateClient();
        await BringWorkerOnline();
        await BringWorkerOnline();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);
        _factory.ExecuteClaimedWork.Clear();
        _factory.KillHarnessProcesses.Clear();

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        await WaitFor(
            async () => (await Get(client, id)).Status == TrackedWorkItemStatuses.Claimed,
            "item claimed"
        );
        var holder = (await Get(client, id)).HolderId!.Value;
        await WaitFor(async () => (await ListRuns(client, id)).Count == 1, "run born");
        var deadRunId = (await ListRuns(client, id)).Single().Id;

        (
            await Post(
                client,
                "/start-tracked-work-item",
                new
                {
                    id,
                    runId = deadRunId,
                    actor = WorkItemLifecycleActors.ForWorker(holder),
                    reason = "start",
                    expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Claimed },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await Post(
                client,
                "/hold-tracked-work-item",
                new
                {
                    id,
                    runId = deadRunId,
                    actor = WorkItemLifecycleActors.ForWorker(holder),
                    reason = "need person",
                    expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Running },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.NeedsAttention);

        await DeclareOffline(holder);

        await WaitFor(
            async () => (await GetWorker(client, holder)).IsOnline == false,
            "holder offline"
        );
        await WaitFor(
            async () =>
                (await ListRuns(client, id)).Single(r => r.Id == deadRunId).Outcome
                == RunOutcome.Abandoned,
            "run abandoned with worker-death"
        );
        await WaitFor(
            async () =>
            {
                var item = await Get(client, id);
                return item.Status
                    is TrackedWorkItemStatuses.Pending
                        or TrackedWorkItemStatuses.Claimed;
            },
            "needs-attention released to pending/claimed"
        );
    }

    [Fact]
    public async Task report_first_skips_release_when_item_already_terminal()
    {
        var client = _factory.CreateClient();
        await BringWorkerOnline();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        await WaitFor(
            async () => (await Get(client, id)).Status == TrackedWorkItemStatuses.Claimed,
            "claimed"
        );
        var holder = (await Get(client, id)).HolderId!.Value;
        await WaitFor(async () => (await ListRuns(client, id)).Count == 1, "run born");
        var runId = (await ListRuns(client, id)).Single().Id;

        (
            await Post(
                client,
                "/start-tracked-work-item",
                new
                {
                    id,
                    runId,
                    actor = WorkItemLifecycleActors.ForWorker(holder),
                    reason = "start",
                    expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Claimed },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await Post(
                client,
                "/succeed-run",
                new
                {
                    id = runId,
                    actor = WorkItemLifecycleActors.ForWorker(holder),
                    reason = "done",
                    expected = new JsonObject { ["outcome"] = null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await Post(
                client,
                "/succeed-tracked-work-item",
                new
                {
                    id,
                    runId,
                    actor = WorkItemLifecycleActors.ForWorker(holder),
                    reason = "done",
                    expected = new JsonObject { ["status"] = TrackedWorkItemStatuses.Running },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Succeeded);

        await DeclareOffline(holder);

        await WaitFor(
            async () => !(await GetWorker(client, holder)).IsOnline,
            "worker offline"
        );

        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Succeeded);
        (await ListRuns(client, id)).Single().Outcome.ShouldBe(RunOutcome.Succeeded);
    }

    async Task DeclareOffline(Guid workerId)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        await scope
            .ServiceProvider.GetRequiredService<IMessageBus>()
            .InvokeAsync(new DeclareWorkerOffline { WorkerId = workerId });
    }

    async Task<Guid> BringWorkerOnline()
    {
        var id = Guid.NewGuid();
        var bus = _factory.Services.GetRequiredService<IBifrostBus>();
        await bus.Publish(new WorkerNodeRegistered.Command { Id = id });
        await WaitFor(
            async () =>
            {
                var nodes = await ListWorkers(_factory.CreateClient());
                return nodes.Any(n => n.Id == id && n.IsOnline);
            },
            "worker online"
        );
        return id;
    }

    static async Task WaitFor(Func<Task<bool>> condition, string label)
    {
        var deadline = DateTime.UtcNow.AddSeconds(20);
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

    static object Body(Guid id, string reason) =>
        new
        {
            id,
            actor = WorkItemLifecycleActors.Orchestrator,
            reason,
        };

    static async Task<HttpResponseMessage> Post(HttpClient client, string path, object body)
    {
        var response = await client.PostAsJsonAsync(path, body);
        if (!response.IsSuccessStatusCode && response.StatusCode != HttpStatusCode.BadRequest)
        {
            var content = await response.Content.ReadAsStringAsync();
            throw new Exception($"{(int)response.StatusCode} {path}: {content}");
        }

        return response;
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
        return (await response.Content.ReadFromJsonAsync<GetTrackedWorkItemApi.Response>(
            JsonOptions
        ))!;
    }

    static async Task<WorkerNodeDto> GetWorker(HttpClient client, Guid id)
    {
        var nodes = await ListWorkers(client);
        return nodes.Single(n => n.Id == id);
    }

    static async Task<List<WorkerNodeDto>> ListWorkers(HttpClient client)
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), "/list-worker-nodes")
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        };
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<List<WorkerNodeDto>>(JsonOptions))!;
    }

    static async Task<ListTrackedWorkItemsHeldByWorkerApi.Response> ListHeld(
        HttpClient client,
        Guid workerId
    )
    {
        var request = new HttpRequestMessage(
            new HttpMethod("QUERY"),
            $"/list-tracked-work-items-held-by/{workerId}"
        )
        {
            Content = JsonContent.Create(new { }),
        };
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return (
            await response.Content.ReadFromJsonAsync<ListTrackedWorkItemsHeldByWorkerApi.Response>(
                JsonOptions
            )
        )!;
    }

    static async Task<List<ListRunsForWorkItemApi.Response.Item>> ListRuns(
        HttpClient client,
        Guid workItemId
    )
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), "/list-runs-for-work-item")
        {
            Content = JsonContent.Create(new { workItemId }),
        };
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        var body = (
            await response.Content.ReadFromJsonAsync<ListRunsForWorkItemApi.Response>(JsonOptions)
        )!;
        return body.Items.ToList();
    }

    sealed record WorkerNodeDto(
        Guid Id,
        bool IsAvailable,
        bool IsOnline,
        DateTimeOffset? LastHeartbeatAt
    );
}
