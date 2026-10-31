using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bifrost.Orchestrator.Contracts;
using Shouldly;

namespace Bifrost.Tests.Api;

[Collection("orchestrator")]
public class TrackedWorkItemLifecycleTests
{
    readonly OrchestratorApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public TrackedWorkItemLifecycleTests(OrchestratorApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task create_claim_start_succeed_records_orchestrator_status_and_mirrors_ledger()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);

        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Pending);
        _factory.WorkItemLedger.StatusOf(id).ShouldBe(TrackedWorkItemStatuses.Pending);
        _factory
            .WorkItemLedger.HistoryOf(id)
            .ShouldHaveSingleItem()
            .ShouldBe(
                new Support.InMemoryWorkItemLedger.HistoryEntry(
                    TrackedWorkItemStatuses.Pending,
                    WorkItemLifecycleActors.Orchestrator,
                    "accept"
                )
            );

        (await Post(client, "/claim-tracked-work-item", Body(id, "dispatch"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Claimed);

        (await Post(client, "/start-tracked-work-item", Body(id, "harness"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Running);

        (await Post(client, "/succeed-tracked-work-item", Body(id, "done"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Succeeded);
        _factory.WorkItemLedger.StatusOf(id).ShouldBe(TrackedWorkItemStatuses.Succeeded);
        _factory
            .WorkItemLedger.HistoryOf(id)
            .Select(h => h.Actor)
            .Distinct()
            .ShouldBe([WorkItemLifecycleActors.Orchestrator]);
    }

    [Fact]
    public async Task release_returns_to_pending_from_claimed_and_running()
    {
        var client = _factory.CreateClient();

        var claimed = await CreateAt(client, TrackedWorkItemStatuses.Claimed);
        (
            await Post(client, "/release-tracked-work-item", Body(claimed, "dead-worker"))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Get(client, claimed)).Status.ShouldBe(TrackedWorkItemStatuses.Pending);

        var running = await CreateAt(client, TrackedWorkItemStatuses.Running);
        (
            await Post(client, "/release-tracked-work-item", Body(running, "dead-worker"))
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Get(client, running)).Status.ShouldBe(TrackedWorkItemStatuses.Pending);
    }

    [Fact]
    public async Task cancel_records_requester_and_rejects_from_terminal()
    {
        var client = _factory.CreateClient();
        var id = await CreateAt(client, TrackedWorkItemStatuses.Running);

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

        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Canceled);
        _factory.WorkItemLedger.HistoryOf(id).Last().Actor.ShouldBe("alice");
        _factory.WorkItemLedger.HistoryOf(id).Last().Reason.ShouldBe("stop");

        (
            await Post(
                client,
                "/cancel-tracked-work-item",
                new
                {
                    id,
                    actor = "bob",
                    reason = "again",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task stale_expected_status_is_rejected_as_validation_error()
    {
        var client = _factory.CreateClient();
        var id = await CreateAt(client, TrackedWorkItemStatuses.Pending);

        (
            await Post(
                client,
                "/claim-tracked-work-item",
                new
                {
                    id,
                    actor = "orchestrator",
                    reason = "race",
                    expected = new { status = TrackedWorkItemStatuses.Running },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Pending);
    }

    [Fact]
    public async Task ledger_expected_state_rejects_concurrent_mirror()
    {
        var client = _factory.CreateClient();
        var id = await CreateAt(client, TrackedWorkItemStatuses.Claimed);

        // Corrupt the ledger so the mirror CAS fails while orchestrator state is claimed.
        _factory.WorkItemLedger.Seed(id, TrackedWorkItemStatuses.Running);

        var response = await Post(
            client,
            "/start-tracked-work-item",
            Body(id, "harness")
        );
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).ShouldContain("expected state");
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Claimed);
    }

    [Fact]
    public async Task fail_from_pending_is_rejected()
    {
        var client = _factory.CreateClient();
        var id = await CreateAt(client, TrackedWorkItemStatuses.Pending);

        (await Post(client, "/fail-tracked-work-item", Body(id, "nope"))).StatusCode.ShouldBe(
            HttpStatusCode.BadRequest
        );
        (await Get(client, id)).Status.ShouldBe(TrackedWorkItemStatuses.Pending);
    }

    async Task<Guid> CreateAt(HttpClient client, string status)
    {
        var id = Guid.NewGuid();
        _factory.WorkItemLedger.Seed(id);
        (await Post(client, "/create-tracked-work-item", Body(id, "accept"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );

        if (status is TrackedWorkItemStatuses.Pending)
        {
            return id;
        }

        (await Post(client, "/claim-tracked-work-item", Body(id, "dispatch"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        if (status is TrackedWorkItemStatuses.Claimed)
        {
            return id;
        }

        (await Post(client, "/start-tracked-work-item", Body(id, "harness"))).StatusCode.ShouldBe(
            HttpStatusCode.NoContent
        );
        if (status is TrackedWorkItemStatuses.Running)
        {
            return id;
        }

        throw new InvalidOperationException($"Unsupported setup status '{status}'.");
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

    async Task<GetTrackedWorkItemApi.Response> Get(HttpClient client, Guid id)
    {
        var request = new HttpRequestMessage(
            new HttpMethod("QUERY"),
            $"/get-tracked-work-item/{id}"
        )
        {
            Content = JsonContent.Create(new { }),
        };
        var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            throw new Exception($"{(int)response.StatusCode} get-tracked-work-item: {content}");
        }

        return (await response.Content.ReadFromJsonAsync<GetTrackedWorkItemApi.Response>(
            JsonOptions
        ))!;
    }
}
