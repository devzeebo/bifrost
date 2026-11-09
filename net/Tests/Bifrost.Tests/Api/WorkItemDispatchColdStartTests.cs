using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Wolverine.Runtime.Heartbeat;

namespace Bifrost.Tests.Api;

/// <summary>
/// Isolated factory so no leftover online workers can claim before the heartbeat under test.
/// </summary>
[CollectionDefinition("orchestrator-dispatch-cold")]
public sealed class OrchestratorDispatchColdCollection
    : ICollectionFixture<OrchestratorApiFactory>;

[Collection("orchestrator-dispatch-cold")]
public class WorkItemDispatchColdStartTests
{
    readonly OrchestratorApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public WorkItemDispatchColdStartTests(OrchestratorApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task create_with_zero_online_workers_stays_pending_until_heartbeat()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Pending);

        var workerId = Guid.NewGuid();
        var bus = _factory.Services.GetRequiredService<IBifrostBus>();
        await bus.Publish(new WorkerNodeRegistered.Command { Id = workerId });
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Pending);

        await bus.Publish(
            new WolverineHeartbeat(workerId.ToString(), 1, DateTimeOffset.UtcNow, TimeSpan.Zero)
        );

        await WaitFor(
            async () => (await Get(client, id)).Status == TrackedWorkItemStatuses.Claimed,
            "item claimed after worker online"
        );
        (await Get(client, id)).HolderId.ShouldBe(workerId);
    }

    static object Body(Guid id, string reason) =>
        new
        {
            id,
            actor = WorkItemLifecycleActors.Orchestrator,
            reason,
        };

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
}
