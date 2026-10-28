using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using Bifrost.Orchestrator.Contracts;
using Shouldly;

namespace Bifrost.Tests.Api;

[Collection("orchestrator")]
public class RunTrackerTests
{
    readonly OrchestratorApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters =
        {
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false),
        },
    };

    public RunTrackerTests(OrchestratorApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task create_run_starts_without_outcome()
    {
        var client = _factory.CreateClient();
        var runId = Guid.NewGuid();
        var workItemId = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-run",
                new
                {
                    id = runId,
                    workItemId,
                    actor = "orchestrator-a",
                    reason = "dispatch",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var run = await Query<GetRunApi.Response>(client, $"/get-run/{runId}");
        run.ShouldNotBeNull();
        run.Id.ShouldBe(runId);
        run.WorkItemId.ShouldBe(workItemId);
        run.Outcome.ShouldBeNull();
        run.Data.ShouldBeOfType<JsonObject>().Count.ShouldBe(0);
        run.Metadata.ShouldBeOfType<JsonObject>().Count.ShouldBe(0);
    }

    [Fact]
    public async Task create_run_rejects_duplicate_id()
    {
        var client = _factory.CreateClient();
        var runId = Guid.NewGuid();
        var workItemId = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-run",
                new
                {
                    id = runId,
                    workItemId,
                    actor = "orchestrator-a",
                    reason = "first",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/create-run",
                new
                {
                    id = runId,
                    workItemId = Guid.NewGuid(),
                    actor = "orchestrator-a",
                    reason = "duplicate",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task create_run_rejects_nonempty_expected()
    {
        var client = _factory.CreateClient();

        (
            await Post(
                client,
                "/create-run",
                new
                {
                    id = Guid.NewGuid(),
                    workItemId = Guid.NewGuid(),
                    actor = "orchestrator-a",
                    reason = "create",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task succeed_fail_and_abandon_set_matching_outcomes()
    {
        var client = _factory.CreateClient();
        var workItemId = Guid.NewGuid();

        var succeeded = await CreateRun(client, workItemId);
        (
            await Post(
                client,
                "/succeed-run",
                new
                {
                    id = succeeded,
                    actor = "orchestrator-a",
                    reason = "harness ok",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Query<GetRunApi.Response>(client, $"/get-run/{succeeded}"))!
            .Outcome.ShouldBe(RunOutcome.Succeeded);

        var failed = await CreateRun(client, workItemId);
        (
            await Post(
                client,
                "/fail-run",
                new
                {
                    id = failed,
                    actor = "orchestrator-a",
                    reason = "harness error",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Query<GetRunApi.Response>(client, $"/get-run/{failed}"))!
            .Outcome.ShouldBe(RunOutcome.Failed);

        var abandoned = await CreateRun(client, workItemId);
        (
            await Post(
                client,
                "/abandon-run",
                new
                {
                    id = abandoned,
                    actor = "orchestrator-a",
                    reason = "worker died",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Query<GetRunApi.Response>(client, $"/get-run/{abandoned}"))!
            .Outcome.ShouldBe(RunOutcome.Abandoned);
    }

    [Fact]
    public async Task terminal_transition_rejects_stale_expected_state()
    {
        var client = _factory.CreateClient();
        var runId = await CreateRun(client, Guid.NewGuid());

        (
            await Post(
                client,
                "/succeed-run",
                new
                {
                    id = runId,
                    actor = "orchestrator-a",
                    reason = "first success",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/fail-run",
                new
                {
                    id = runId,
                    actor = "orchestrator-b",
                    reason = "stale failure",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (await Query<GetRunApi.Response>(client, $"/get-run/{runId}"))!
            .Outcome.ShouldBe(RunOutcome.Succeeded);
    }

    [Fact]
    public async Task null_expected_force_updates_terminal_outcome()
    {
        var client = _factory.CreateClient();
        var runId = await CreateRun(client, Guid.NewGuid());

        (
            await Post(
                client,
                "/succeed-run",
                new
                {
                    id = runId,
                    actor = "orchestrator-a",
                    reason = "first",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/abandon-run",
                new
                {
                    id = runId,
                    actor = "orchestrator-a",
                    reason = "repair",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await Query<GetRunApi.Response>(client, $"/get-run/{runId}"))!
            .Outcome.ShouldBe(RunOutcome.Abandoned);
    }

    [Fact]
    public async Task list_runs_for_work_item_returns_attempt_history()
    {
        var client = _factory.CreateClient();
        var workItemId = Guid.NewGuid();
        var otherWorkItemId = Guid.NewGuid();

        var first = await CreateRun(client, workItemId);
        var second = await CreateRun(client, workItemId);
        await CreateRun(client, otherWorkItemId);

        (
            await Post(
                client,
                "/fail-run",
                new
                {
                    id = first,
                    actor = "orchestrator-a",
                    reason = "attempt 1",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/succeed-run",
                new
                {
                    id = second,
                    actor = "orchestrator-a",
                    reason = "attempt 2",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var listed = await Query<ListRunsForWorkItemApi.Response>(
            client,
            "/list-runs-for-work-item",
            new { workItemId }
        );
        listed.ShouldNotBeNull();
        listed.Items.Count.ShouldBe(2);
        listed.Items.ShouldContain(x => x.Id == first && x.Outcome == RunOutcome.Failed);
        listed.Items.ShouldContain(x => x.Id == second && x.Outcome == RunOutcome.Succeeded);
        listed.Items.ShouldAllBe(x => x.WorkItemId == workItemId);
    }

    [Fact]
    public async Task replace_run_data_and_metadata_attach_without_changing_outcome()
    {
        var client = _factory.CreateClient();
        var runId = await CreateRun(client, Guid.NewGuid());

        (
            await Post(
                client,
                "/replace-run-data",
                new
                {
                    id = runId,
                    data = new { turns = 3, costUsd = 0.12 },
                    actor = "orchestrator-a",
                    reason = "harness stats",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/replace-run-metadata",
                new
                {
                    id = runId,
                    metadata = new { workerId = "worker-1" },
                    actor = "orchestrator-a",
                    reason = "pin worker",
                    expected = new { outcome = (string?)null },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var run = (await Query<GetRunApi.Response>(client, $"/get-run/{runId}"))!;
        run.Outcome.ShouldBeNull();
        run.Data!["turns"]!.GetValue<int>().ShouldBe(3);
        run.Metadata["workerId"]!.GetValue<string>().ShouldBe("worker-1");
    }

    [Fact]
    public async Task replace_run_data_rejects_stale_expected_data()
    {
        var client = _factory.CreateClient();
        var runId = await CreateRun(client, Guid.NewGuid());

        (
            await Post(
                client,
                "/replace-run-data",
                new
                {
                    id = runId,
                    data = new { turns = 1 },
                    actor = "orchestrator-a",
                    reason = "initial",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/replace-run-data",
                new
                {
                    id = runId,
                    data = new { turns = 99 },
                    actor = "orchestrator-b",
                    reason = "stale",
                    expected = new { data = new { turns = 0 } },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (await Query<GetRunApi.Response>(client, $"/get-run/{runId}"))!
            .Data!["turns"]!.GetValue<int>()
            .ShouldBe(1);
    }

    [Fact]
    public async Task replace_run_metadata_rejects_stale_expected_metadata()
    {
        var client = _factory.CreateClient();
        var runId = await CreateRun(client, Guid.NewGuid());

        (
            await Post(
                client,
                "/replace-run-metadata",
                new
                {
                    id = runId,
                    metadata = new { workerId = "worker-1" },
                    actor = "orchestrator-a",
                    reason = "initial",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/replace-run-metadata",
                new
                {
                    id = runId,
                    metadata = new { workerId = "worker-2" },
                    actor = "orchestrator-b",
                    reason = "stale",
                    expected = new { metadata = new { workerId = "other" } },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (await Query<GetRunApi.Response>(client, $"/get-run/{runId}"))!
            .Metadata["workerId"]!.GetValue<string>()
            .ShouldBe("worker-1");
    }

    async Task<Guid> CreateRun(HttpClient client, Guid workItemId)
    {
        var runId = Guid.NewGuid();
        (
            await Post(
                client,
                "/create-run",
                new
                {
                    id = runId,
                    workItemId,
                    actor = "orchestrator-a",
                    reason = "start attempt",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        return runId;
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

    static Task<T?> Query<T>(HttpClient client, string path) => Query<T>(client, path, new { });

    static async Task<T?> Query<T>(HttpClient client, string path, object body)
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), path)
        {
            Content = JsonContent.Create(body),
        };
        var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            throw new Exception($"{(int)response.StatusCode} {path}: {content}");
        }

        return await response.Content.ReadFromJsonAsync<T>(JsonOptions);
    }
}
