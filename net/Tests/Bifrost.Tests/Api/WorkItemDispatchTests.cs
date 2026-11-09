extern alias Orchestrator;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Wolverine;
using DeliverClaimedWork = Orchestrator::Bifrost.TrackedWorkItems.Dispatch.DeliverClaimedWork;
using TrackedWorkItemModel = Orchestrator::Bifrost.TrackedWorkItems.Projections.TrackedWorkItemView.Model;

namespace Bifrost.Tests.Api;

[CollectionDefinition("orchestrator-dispatch-manual")]
public sealed class OrchestratorDispatchManualCollection
    : ICollectionFixture<OrchestratorApiFactory>;

/// <summary>
/// Manual claim/handoff coverage with no online workers, so create stays pending.
/// </summary>
[Collection("orchestrator-dispatch-manual")]
public class WorkItemDispatchTests
{
    readonly OrchestratorApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public WorkItemDispatchTests(OrchestratorApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task concurrent_claims_leave_exactly_one_holder()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        var first = await RegisterWorker();
        var second = await RegisterWorker();
        _factory.WorkItemLedger.Seed(id);

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Pending);

        var a = Post(client, "/claim-tracked-work-item", Body(id, "race-a", first));
        var b = Post(client, "/claim-tracked-work-item", Body(id, "race-b", second));
        var results = await Task.WhenAll(a, b);

        results.Count(r => r.StatusCode == HttpStatusCode.NoContent).ShouldBe(1);
        results.Count(r => r.StatusCode == HttpStatusCode.BadRequest).ShouldBe(1);

        var item = await Get(client, id);
        item.Status.ShouldBe(TrackedWorkItemStatuses.Claimed);
        item.HolderId.ShouldBeOneOf(first, second);

        await WaitFor(
            async () => (await ListRuns(client, id)).Count == 1,
            "run born for winner"
        );
    }

    [Fact]
    public async Task holder_query_lists_claimed_and_running_and_clears_on_release()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var claimedId = Guid.NewGuid();
        var runningId = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(claimedId);
        _factory.WorkItemLedger.Seed(runningId);

        (await Post(client, "/create-tracked-work-item", Body(claimedId, "accept")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Post(client, "/create-tracked-work-item", Body(runningId, "accept")))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(client, "/claim-tracked-work-item", Body(claimedId, "dispatch", workerId))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await Post(client, "/claim-tracked-work-item", Body(runningId, "dispatch", workerId))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await WaitFor(
            async () => (await ListRuns(client, runningId)).Count == 1,
            "run for running item"
        );
        var runningRunId = (await ListRuns(client, runningId)).Single().Id;
        (
            await Post(
                client,
                "/start-tracked-work-item",
                new
                {
                    id = runningId,
                    runId = runningRunId,
                    actor = WorkItemLifecycleActors.ForWorker(workerId),
                    reason = "harness",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var held = await ListHeld(client, workerId);
        held.Items.Select(i => i.Id)
            .OrderBy(x => x)
            .ToArray()
            .ShouldBe(new[] { claimedId, runningId }.OrderBy(x => x).ToArray());
        held.Items.ShouldAllBe(i => i.HolderId == workerId);

        (
            await Post(client, "/release-tracked-work-item", Body(claimedId, "dead-worker"))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await Post(
                client,
                "/cancel-tracked-work-item",
                new
                {
                    id = runningId,
                    actor = "alice",
                    reason = "stop",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await ListHeld(client, workerId)).Items.ShouldBeEmpty();
    }

    [Fact]
    public async Task cancel_before_handoff_skips_delivery()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var id = Guid.NewGuid();
        var runId = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);
        _factory.ExecuteClaimedWork.Clear();

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (
            await Post(client, "/claim-tracked-work-item", Body(id, "dispatch", workerId))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await WaitFor(
            () => Task.FromResult(_factory.ExecuteClaimedWork.Received.Any(r => r.WorkItemId == id)),
            "initial handoff"
        );
        _factory.ExecuteClaimedWork.Clear();

        (
            await Post(
                client,
                "/cancel-tracked-work-item",
                new
                {
                    id,
                    actor = "alice",
                    reason = "stop",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            await scope
                .ServiceProvider.GetRequiredService<IMessageBus>()
                .InvokeAsync(
                    new DeliverClaimedWork
                    {
                        WorkItemId = id,
                        WorkerId = workerId,
                        RunId = runId,
                    }
                );
        }

        _factory.ExecuteClaimedWork.Received.ShouldBeEmpty();
    }

    [Fact]
    public async Task handoff_rethrows_while_held_then_succeeds_on_retry()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);
        _factory.ExecuteClaimedWork.Clear();

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (
            await Post(client, "/claim-tracked-work-item", Body(id, "dispatch", workerId))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await WaitFor(
            () => Task.FromResult(_factory.ExecuteClaimedWork.Received.Any(r => r.WorkItemId == id)),
            "initial handoff"
        );
        var runId = _factory.ExecuteClaimedWork.Received.Single(r => r.WorkItemId == id).RunId;
        _factory.ExecuteClaimedWork.Clear();
        _factory.ExecuteClaimedWork.FailuresRemaining = 1;

        var deliver = new DeliverClaimedWork
        {
            WorkItemId = id,
            WorkerId = workerId,
            RunId = runId,
        };

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var bus = scope.ServiceProvider.GetRequiredService<IMessageBus>();
            await Should.ThrowAsync<BusException>(() => bus.InvokeAsync(deliver));
            _factory.ExecuteClaimedWork.FailuresRemaining.ShouldBe(0);
            _factory.ExecuteClaimedWork.Received.ShouldBeEmpty();

            await bus.InvokeAsync(deliver);
        }

        _factory.ExecuteClaimedWork.Received.ShouldHaveSingleItem().WorkItemId.ShouldBe(id);
        (await Get(client, id)).HolderId.ShouldBe(workerId);
    }

    [Fact]
    public async Task handoff_bus_failure_drops_after_release()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);
        _factory.ExecuteClaimedWork.Clear();

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (
            await Post(client, "/claim-tracked-work-item", Body(id, "dispatch", workerId))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await WaitFor(
            () => Task.FromResult(_factory.ExecuteClaimedWork.Received.Any(r => r.WorkItemId == id)),
            "initial handoff"
        );
        var runId = _factory.ExecuteClaimedWork.Received.Single(r => r.WorkItemId == id).RunId;
        _factory.ExecuteClaimedWork.Clear();
        _factory.ExecuteClaimedWork.FailuresRemaining = 1;

        (
            await Post(client, "/release-tracked-work-item", Body(id, "dead-worker"))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            await scope
                .ServiceProvider.GetRequiredService<IMessageBus>()
                .InvokeAsync(
                    new DeliverClaimedWork
                    {
                        WorkItemId = id,
                        WorkerId = workerId,
                        RunId = runId,
                    }
                );
        }

        _factory.ExecuteClaimedWork.Received.ShouldBeEmpty();
        _factory.ExecuteClaimedWork.FailuresRemaining.ShouldBe(1);
    }

    [Fact]
    public async Task holder_query_survives_projection_reload()
    {
        var client = _factory.CreateClient();
        var workerId = await RegisterWorker();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (
            await Post(client, "/claim-tracked-work-item", Body(id, "dispatch", workerId))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await using var session = _factory
            .Services.GetRequiredService<IDocumentStore>()
            .LightweightSession();
        var projected = await session.LoadAsync<TrackedWorkItemModel>(id);
        projected.ShouldNotBeNull();
        projected!.HolderId.ShouldBe(workerId);

        var held = await ListHeld(client, workerId);
        held.Items.ShouldHaveSingleItem().Id.ShouldBe(id);
    }

    async Task<Guid> RegisterWorker()
    {
        var id = Guid.NewGuid();
        await _factory
            .Services.GetRequiredService<IBifrostBus>()
            .Publish(new WorkerNodeRegistered.Command { Id = id });
        return id;
    }

    static async Task WaitFor(Func<Task<bool>> condition, string label)
    {
        var deadline = DateTime.UtcNow.AddSeconds(15);
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

    static object Body(Guid id, string reason, Guid? workerId = null) =>
        workerId is { } worker
            ? new
            {
                id,
                workerId = worker,
                actor = WorkItemLifecycleActors.Orchestrator,
                reason,
            }
            : new
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
}
