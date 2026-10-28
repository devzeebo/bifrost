using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost.Rpc;
using Bifrost.WorkItems.Contracts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Testcontainers.PostgreSql;

namespace Bifrost.Tests.Api;

public sealed class BifrostApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .WithDatabase("bifrost_test")
        .WithUsername("bifrost")
        .WithPassword("bifrost")
        .Build();

    string _connectionString = string.Empty;

    async Task IAsyncLifetime.InitializeAsync()
    {
        await _postgres.StartAsync();
        _connectionString = _postgres.GetConnectionString();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await _postgres.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:Marten", _connectionString);

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IRpcHost>();
            services.RemoveAll<RpcHost>();
            foreach (var descriptor in services.Where(IsRpcHostedService).ToList())
            {
                services.Remove(descriptor);
            }
        });
    }

    static bool IsRpcHostedService(ServiceDescriptor descriptor) =>
        descriptor.ServiceType == typeof(IHostedService)
        && descriptor.ImplementationType?.Name is "RpcHostedService";
}

[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<BifrostApiFactory>;

[Collection("api")]
public class WorkItemTrackerTests
{
    readonly BifrostApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public WorkItemTrackerTests(BifrostApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task define_relationship_type_rejects_duplicate_words()
    {
        var client = _factory.CreateClient();
        var typeId = Guid.NewGuid();
        var forward = $"fwd_{typeId:N}"[..16];
        var inverse = $"inv_{typeId:N}"[..16];

        (
            await Post(
                client,
                "/define-relationship-type",
                new
                {
                    id = typeId,
                    forwardWord = forward,
                    inverseWord = inverse,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var duplicate = await Post(
            client,
            "/define-relationship-type",
            new
            {
                id = Guid.NewGuid(),
                forwardWord = forward.ToUpperInvariant(),
                inverseWord = $"other_{Guid.NewGuid():N}"[..16],
            }
        );
        duplicate.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task add_relationship_maintains_inverse_on_related_work_item()
    {
        var client = _factory.CreateClient();
        var typeId = Guid.NewGuid();
        var wordForward = $"blocks_{typeId:N}"[..20];
        var wordInverse = $"blocked_by_{typeId:N}"[..24];

        (
            await Post(
                client,
                "/define-relationship-type",
                new
                {
                    id = typeId,
                    forwardWord = wordForward,
                    inverseWord = wordInverse,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var workItemA = Guid.NewGuid();
        var workItemB = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id = workItemA,
                    data = new { title = "A" },
                    status = "open",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id = workItemB,
                    data = new { title = "B" },
                    status = "open",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/add-relationship",
                new
                {
                    workItemId = workItemA,
                    word = wordForward,
                    relatedWorkItemId = workItemB,
                    actor = "tester",
                    reason = "related",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var itemA = await Query<WorkItemResponseDto>(client, $"/get-work-item/{workItemA}");
        var itemB = await Query<WorkItemResponseDto>(client, $"/get-work-item/{workItemB}");

        itemA.ShouldNotBeNull();
        itemB.ShouldNotBeNull();
        itemA.Relationships.ShouldContain(r =>
            r.RelatedWorkItemId == workItemB && r.Word == wordForward
        );
        itemB.Relationships.ShouldContain(r =>
            r.RelatedWorkItemId == workItemA && r.Word == wordInverse
        );
    }

    [Fact]
    public async Task remove_relationship_removes_inverse()
    {
        var client = _factory.CreateClient();
        var typeId = Guid.NewGuid();
        var wordForward = $"relates_{typeId:N}"[..20];

        (
            await Post(
                client,
                "/define-relationship-type",
                new
                {
                    id = typeId,
                    forwardWord = wordForward,
                    inverseWord = wordForward,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var workItemA = Guid.NewGuid();
        var workItemB = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id = workItemA,
                    data = new { },
                    status = "open",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id = workItemB,
                    data = new { },
                    status = "open",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/add-relationship",
                new
                {
                    workItemId = workItemA,
                    word = wordForward,
                    relatedWorkItemId = workItemB,
                    actor = "tester",
                    reason = "related",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/remove-relationship",
                new
                {
                    workItemId = workItemA,
                    word = wordForward,
                    relatedWorkItemId = workItemB,
                    actor = "tester",
                    reason = "related",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var itemA = await Query<WorkItemResponseDto>(client, $"/get-work-item/{workItemA}");
        var itemB = await Query<WorkItemResponseDto>(client, $"/get-work-item/{workItemB}");

        itemA.ShouldNotBeNull();
        itemB.ShouldNotBeNull();
        itemA.Relationships.ShouldBeEmpty();
        itemB.Relationships.ShouldBeEmpty();
    }

    [Fact]
    public async Task replace_work_item_data_and_list_queries()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id,
                    data = new { title = "before" },
                    status = "Open",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/replace-work-item-data",
                new
                {
                    id,
                    data = new { title = "after", tags = new[] { "x" } },
                    actor = "tester",
                    reason = "replaced data",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var item = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        item.ShouldNotBeNull();
        item.Data["title"]!.GetValue<string>().ShouldBe("after");
        item.Status.ShouldBe("open");

        var list = await Query<ListWorkItemsApi.Response>(client, "/list-work-items", new { });
        list.ShouldNotBeNull();
        list.Items.ShouldContain(x => x.Id == id && !x.IsDeleted && x.Status == "open");
    }

    [Fact]
    public async Task change_work_item_status_and_filter_list()
    {
        var client = _factory.CreateClient();
        var openId = Guid.NewGuid();
        var claimedId = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id = openId,
                    data = new { },
                    status = "  OPEN  ",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id = claimedId,
                    data = new { },
                    status = "open",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/change-work-item-status",
                new
                {
                    id = claimedId,
                    status = "Claimed",
                    actor = "orchestrator-a",
                    reason = "claimed for execution",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var claimed = await Query<WorkItemResponseDto>(client, $"/get-work-item/{claimedId}");
        claimed.ShouldNotBeNull();
        claimed.Status.ShouldBe("claimed");

        var openList = await Query<ListWorkItemsApi.Response>(
            client,
            "/list-work-items",
            new { status = " Open " }
        );
        openList.ShouldNotBeNull();
        openList.Items.ShouldContain(x => x.Id == openId);
        openList.Items.ShouldNotContain(x => x.Id == claimedId);

        var claimedList = await Query<ListWorkItemsApi.Response>(
            client,
            "/list-work-items",
            new { status = "claimed" }
        );
        claimedList.ShouldNotBeNull();
        claimedList.Items.ShouldContain(x => x.Id == claimedId);
        claimedList.Items.ShouldNotContain(x => x.Id == openId);
    }

    [Fact]
    public async Task create_and_change_work_item_status_reject_blank()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id,
                    data = new { },
                    status = "   ",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id,
                    data = new { },
                    status = "open",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/change-work-item-status",
                new
                {
                    id,
                    status = "",
                    actor = "orchestrator-a",
                    reason = "blank",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (
            await Post(
                client,
                "/replace-work-item-data",
                new
                {
                    id,
                    data = new { },
                    actor = " ",
                    reason = "replaced data",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (
            await Post(
                client,
                "/delete-work-item",
                new
                {
                    id,
                    actor = "tester",
                    reason = " ",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task change_relationship_type_words_updates_word_lookup()
    {
        var client = _factory.CreateClient();
        var typeId = Guid.NewGuid();
        var oldForward = $"old_fwd_{typeId:N}"[..20];
        var oldInverse = $"old_inv_{typeId:N}"[..20];
        var newForward = $"new_fwd_{typeId:N}"[..20];
        var newInverse = $"new_inv_{typeId:N}"[..20];

        (
            await Post(
                client,
                "/define-relationship-type",
                new
                {
                    id = typeId,
                    forwardWord = oldForward,
                    inverseWord = oldInverse,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var workItemA = Guid.NewGuid();
        var workItemB = Guid.NewGuid();
        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id = workItemA,
                    data = new { },
                    status = "open",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id = workItemB,
                    data = new { },
                    status = "open",
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/add-relationship",
                new
                {
                    workItemId = workItemA,
                    word = oldForward,
                    relatedWorkItemId = workItemB,
                    actor = "tester",
                    reason = "related",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/change-relationship-type-words",
                new
                {
                    id = typeId,
                    forwardWord = newForward,
                    inverseWord = newInverse,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/add-relationship",
                new
                {
                    workItemId = workItemA,
                    word = oldForward,
                    relatedWorkItemId = workItemB,
                    actor = "tester",
                    reason = "related",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var itemA = await Query<WorkItemResponseDto>(client, $"/get-work-item/{workItemA}");
        var itemB = await Query<WorkItemResponseDto>(client, $"/get-work-item/{workItemB}");
        itemA.ShouldNotBeNull();
        itemB.ShouldNotBeNull();
        itemA.Relationships.ShouldContain(r =>
            r.RelatedWorkItemId == workItemB && r.Word == newForward
        );
        itemB.Relationships.ShouldContain(r =>
            r.RelatedWorkItemId == workItemA && r.Word == newInverse
        );
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
            Content = new StringContent(
                JsonSerializer.Serialize(body),
                Encoding.UTF8,
                "application/json"
            ),
        };
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions);
    }

    sealed record WorkItemRelationshipDto(
        Guid RelationshipTypeId,
        string Word,
        int Direction,
        Guid RelatedWorkItemId
    );

    [Fact]
    public async Task status_and_metadata_are_separate_writes()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        var heldBy = $"worker-{id:N}";

        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id,
                    data = new { title = "slice" },
                    status = "pending",
                    actor = "orchestrator-a",
                    reason = "opened",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var created = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        created.ShouldNotBeNull();
        created.Metadata.Count.ShouldBe(0);

        (
            await Post(
                client,
                "/change-work-item-status",
                new
                {
                    id,
                    status = "claimed",
                    actor = " orchestrator-a ",
                    reason = " claimed for execution ",
                    expected = new { status = "pending" },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var claimed = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        claimed.ShouldNotBeNull();
        claimed.Status.ShouldBe("claimed");
        claimed.Metadata.Count.ShouldBe(0);

        (
            await Post(
                client,
                "/replace-work-item-metadata",
                new
                {
                    id,
                    metadata = new { claimedBy = heldBy, activeRun = "run-a" },
                    actor = "orchestrator-a",
                    reason = "held",
                    expected = new { status = "claimed" },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var held = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        held.ShouldNotBeNull();
        held.Status.ShouldBe("claimed");
        held.Metadata["claimedBy"]!.GetValue<string>().ShouldBe(heldBy);
        held.Metadata["activeRun"]!.GetValue<string>().ShouldBe("run-a");

        (
            await Post(
                client,
                "/change-work-item-status",
                new
                {
                    id,
                    status = "pending",
                    actor = "orchestrator-a",
                    reason = "released",
                    expected = new { metadata = new { claimedBy = heldBy } },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var released = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        released.ShouldNotBeNull();
        released.Status.ShouldBe("pending");
        released.Metadata["claimedBy"]!.GetValue<string>().ShouldBe(heldBy);

        var heldItems = await Query<ListWorkItemsApi.Response>(
            client,
            "/list-work-items",
            new { metadata = new { claimedBy = heldBy } }
        );
        heldItems.ShouldNotBeNull();
        heldItems.Items.ShouldContain(x => x.Id == id && x.Status == "pending");

        (
            await Post(
                client,
                "/replace-work-item-metadata",
                new
                {
                    id,
                    metadata = new { },
                    actor = "orchestrator-a",
                    reason = "cleared",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var cleared = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        cleared.ShouldNotBeNull();
        cleared.Status.ShouldBe("pending");
        cleared.Metadata.Count.ShouldBe(0);
    }

    [Fact]
    public async Task expected_state_rejects_a_stale_write_and_empty_expected_forces_it()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        var missing = await Post(
            client,
            "/create-work-item",
            new
            {
                id,
                data = new { },
                status = "open",
                actor = "tester",
                reason = "created",
                expected = new { status = "open" },
            }
        );
        missing.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await missing.Content.ReadAsStringAsync()).ShouldContain("expected state");

        await CreateItem(client, id, "open");

        var stale = await Post(
            client,
            "/change-work-item-status",
            new
            {
                id,
                status = "claimed",
                actor = "orchestrator-a",
                reason = "claimed for execution",
                expected = new { status = "pending" },
            }
        );
        stale.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await stale.Content.ReadAsStringAsync()).ShouldContain("expected state");

        var unchanged = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        unchanged.ShouldNotBeNull();
        unchanged.Status.ShouldBe("open");

        (
            await Post(
                client,
                "/change-work-item-status",
                new
                {
                    id,
                    status = "claimed",
                    actor = "orchestrator-a",
                    reason = "claimed for execution",
                    expected = (object?)null,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/replace-work-item-metadata",
                new
                {
                    id,
                    metadata = new { claimedBy = "worker-1", activeRun = "run-a" },
                    actor = "orchestrator-a",
                    reason = "held",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var wrongHolder = await Post(
            client,
            "/change-work-item-status",
            new
            {
                id,
                status = "running",
                actor = "orchestrator-a",
                reason = "started",
                expected = new { status = "claimed", metadata = new { claimedBy = "worker-2" } },
            }
        );
        wrongHolder.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var staleMetadata = await Post(
            client,
            "/replace-work-item-metadata",
            new
            {
                id,
                metadata = new { claimedBy = "worker-2" },
                actor = "orchestrator-a",
                reason = "reassigned",
                expected = new { status = "running" },
            }
        );
        staleMetadata.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (
            await Post(
                client,
                "/change-work-item-status",
                new
                {
                    id,
                    status = "running",
                    actor = "orchestrator-a",
                    reason = "started",
                    expected = new
                    {
                        status = "claimed",
                        metadata = new { claimedBy = "worker-1" },
                    },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/change-work-item-status",
                new
                {
                    id,
                    status = "pending",
                    actor = "orchestrator-a",
                    reason = "force released",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var forced = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        forced.ShouldNotBeNull();
        forced.Status.ShouldBe("pending");
        forced.Metadata["claimedBy"]!.GetValue<string>().ShouldBe("worker-1");
    }

    [Fact]
    public async Task work_item_history_includes_actor_and_reason_per_change()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        var relatedId = Guid.NewGuid();
        var typeId = Guid.NewGuid();
        var wordForward = $"relates_{typeId:N}"[..20];

        (
            await Post(
                client,
                "/define-relationship-type",
                new
                {
                    id = typeId,
                    forwardWord = wordForward,
                    inverseWord = wordForward,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        await CreateItem(client, id, "open");
        await CreateItem(client, relatedId, "open");

        (
            await Post(
                client,
                "/change-work-item-status",
                new
                {
                    id,
                    status = "claimed",
                    actor = "orchestrator-a",
                    reason = "claimed for execution",
                    expected = new { status = "open" },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/replace-work-item-metadata",
                new
                {
                    id,
                    metadata = new { claimedBy = "worker-1" },
                    actor = "orchestrator-a",
                    reason = "held by worker",
                    expected = new { status = "claimed" },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/replace-work-item-data",
                new
                {
                    id,
                    data = new { title = "updated" },
                    actor = "orchestrator-a",
                    reason = "replaced data",
                    expected = new { status = "claimed" },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/add-relationship",
                new
                {
                    workItemId = id,
                    word = wordForward,
                    relatedWorkItemId = relatedId,
                    actor = "orchestrator-a",
                    reason = "linked related",
                    expected = new { status = "claimed" },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/remove-relationship",
                new
                {
                    workItemId = id,
                    word = wordForward,
                    relatedWorkItemId = relatedId,
                    actor = "orchestrator-a",
                    reason = "unlinked related",
                    expected = new { status = "claimed" },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/delete-work-item",
                new
                {
                    id,
                    actor = "orchestrator-a",
                    reason = "no longer needed",
                    expected = new { status = "claimed" },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var history = await Query<GetWorkItemHistoryApi.Response>(
            client,
            $"/get-work-item-history/{id}"
        );
        history.ShouldNotBeNull();
        history.Changes.Count.ShouldBe(7);
        history.Changes[0].Type.ShouldBe("WorkItemCreated");
        history.Changes[0].Actor.ShouldBe("tester");
        history.Changes[0].Reason.ShouldBe("created");
        history.Changes[0].Status.ShouldBe("open");
        history.Changes[1].Type.ShouldBe("WorkItemStatusChanged");
        history.Changes[1].Actor.ShouldBe("orchestrator-a");
        history.Changes[1].Reason.ShouldBe("claimed for execution");
        history.Changes[1].Status.ShouldBe("claimed");
        history.Changes[2].Type.ShouldBe("WorkItemMetadataReplaced");
        history.Changes[2].Actor.ShouldBe("orchestrator-a");
        history.Changes[2].Reason.ShouldBe("held by worker");
        history.Changes[2].Status.ShouldBeNull();
        history.Changes[3].Type.ShouldBe("WorkItemDataReplaced");
        history.Changes[3].Actor.ShouldBe("orchestrator-a");
        history.Changes[3].Reason.ShouldBe("replaced data");
        history.Changes[3].Status.ShouldBeNull();
        history.Changes[4].Type.ShouldBe("RelationshipAdded");
        history.Changes[4].Actor.ShouldBe("orchestrator-a");
        history.Changes[4].Reason.ShouldBe("linked related");
        history.Changes[4].Status.ShouldBeNull();
        history.Changes[5].Type.ShouldBe("RelationshipRemoved");
        history.Changes[5].Actor.ShouldBe("orchestrator-a");
        history.Changes[5].Reason.ShouldBe("unlinked related");
        history.Changes[5].Status.ShouldBeNull();
        history.Changes[6].Type.ShouldBe("WorkItemDeleted");
        history.Changes[6].Actor.ShouldBe("orchestrator-a");
        history.Changes[6].Reason.ShouldBe("no longer needed");
        history.Changes[6].Status.ShouldBeNull();

        foreach (var change in history.Changes)
        {
            change.At.ShouldNotBe(default);
        }

        for (var i = 1; i < history.Changes.Count; i++)
        {
            history.Changes[i].At.ShouldBeGreaterThanOrEqualTo(history.Changes[i - 1].At);
        }
    }

    [Fact]
    public async Task deleted_work_item_rejects_status_change()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        await CreateItem(client, id, "open");

        (
            await Post(
                client,
                "/delete-work-item",
                new
                {
                    id,
                    actor = "tester",
                    reason = "deleted",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/change-work-item-status",
                new
                {
                    id,
                    status = "claimed",
                    actor = "orchestrator-a",
                    reason = "claimed for execution",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var item = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        item.ShouldNotBeNull();
        item.IsDeleted.ShouldBeTrue();
        item.Status.ShouldBe("open");
    }

    [Fact]
    public async Task relationship_write_rejects_stale_expected_status()
    {
        var client = _factory.CreateClient();
        var typeId = Guid.NewGuid();
        var wordForward = $"holds_{typeId:N}"[..20];
        var wordInverse = $"held_by_{typeId:N}"[..20];

        (
            await Post(
                client,
                "/define-relationship-type",
                new
                {
                    id = typeId,
                    forwardWord = wordForward,
                    inverseWord = wordInverse,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var workItemA = Guid.NewGuid();
        var workItemB = Guid.NewGuid();
        await CreateItem(client, workItemA, "open");
        await CreateItem(client, workItemB, "open");

        var rejected = await Post(
            client,
            "/add-relationship",
            new
            {
                workItemId = workItemA,
                word = wordForward,
                relatedWorkItemId = workItemB,
                actor = "tester",
                reason = "related",
                expected = new { status = "claimed" },
            }
        );
        rejected.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await rejected.Content.ReadAsStringAsync()).ShouldContain("expected state");

        var itemA = await Query<WorkItemResponseDto>(client, $"/get-work-item/{workItemA}");
        itemA.ShouldNotBeNull();
        itemA.Relationships.ShouldBeEmpty();
    }

    static async Task CreateItem(HttpClient client, Guid id, string status)
    {
        (
            await Post(
                client,
                "/create-work-item",
                new
                {
                    id,
                    data = new { },
                    status,
                    actor = "tester",
                    reason = "created",
                    expected = new { },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    sealed record WorkItemResponseDto(
        Guid Id,
        JsonNode Data,
        string Status,
        JsonObject Metadata,
        List<WorkItemRelationshipDto> Relationships,
        bool IsDeleted
    );
}
