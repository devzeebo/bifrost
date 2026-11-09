using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Wolverine.Runtime.Heartbeat;

namespace Bifrost.Tests.Api;

[CollectionDefinition("orchestrator-dispatch-online")]
public sealed class OrchestratorDispatchOnlineCollection
    : ICollectionFixture<OrchestratorApiFactory>;

[Collection("orchestrator-dispatch-online")]
public class WorkItemDispatchOnlineTests
{
    readonly OrchestratorApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public WorkItemDispatchOnlineTests(OrchestratorApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task create_with_online_worker_claims_holder_births_run_and_handoffs()
    {
        var client = _factory.CreateClient();
        var workerId = await BringWorkerOnline();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);
        _factory.ExecuteClaimedWork.Clear();

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );

        await WaitFor(
            async () => (await Get(client, id)).Status == TrackedWorkItemStatuses.Claimed,
            "item claimed by dispatch"
        );

        var item = await Get(client, id);
        item.HolderId.ShouldNotBeNull();

        var runs = await ListRuns(client, id);
        runs.ShouldHaveSingleItem().WorkItemId.ShouldBe(id);

        await WaitFor(
            () => Task.FromResult(_factory.ExecuteClaimedWork.Received.Any(r => r.WorkItemId == id)),
            "handoff delivered"
        );
        var handoff = _factory
            .ExecuteClaimedWork.Received.Where(r => r.WorkItemId == id)
            .ShouldHaveSingleItem();
        handoff.WorkerId.ShouldBe(item.HolderId!.Value);
        handoff.RunId.ShouldBe(runs[0].Id);

        var online = (await ListWorkers(client)).Where(n => n.IsOnline).Select(n => n.Id).ToList();
        online.ShouldContain(item.HolderId.Value);
        online.ShouldContain(workerId);
    }

    async Task<Guid> BringWorkerOnline()
    {
        var id = Guid.NewGuid();
        var bus = _factory.Services.GetRequiredService<IBifrostBus>();
        await bus.Publish(new WorkerNodeRegistered.Command { Id = id });
        await bus.Publish(
            new WolverineHeartbeat(id.ToString(), 1, DateTimeOffset.UtcNow, TimeSpan.Zero)
        );
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

    sealed record WorkerNodeDto(
        Guid Id,
        bool IsAvailable,
        bool IsOnline,
        DateTimeOffset? LastHeartbeatAt
    );
}
