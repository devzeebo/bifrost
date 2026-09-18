using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost;
using Bifrost.Contracts;
using Bifrost.MessageBus;
using Bifrost.Rpc;
using Marten;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Testcontainers.PostgreSql;
using Wolverine;
using Wolverine.Marten;

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
            // Drop ControlPlane's RPC bus host — tests use an in-process loopback IBifrostBus.
            services.RemoveAll<IBifrostBus>();
            services.RemoveAll<IRpcHost>();
            services.RemoveAll<RpcHost>();
            foreach (var descriptor in services.Where(IsRpcHostedService).ToList())
            {
                services.Remove(descriptor);
            }

            services
                .AddMarten(opts =>
                {
                    opts.Connection(_connectionString);
                    MartenConfiguration.Configure(opts);
                })
                .IntegrateWithWolverine()
                .ApplyAllDatabaseChangesOnStartup();

            services.AddWolverine(opts =>
            {
                opts.Discovery.IncludeAssembly(typeof(MartenConfiguration).Assembly);
                opts.Policies.AutoApplyTransactions();
            });

            DataPlaneBusRegistration.AddHandlers(services);
            services.AddLoopbackBifrostBus();
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
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/replace-work-item-data",
                new { id, data = new { title = "after", tags = new[] { "x" } } }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var item = await Query<WorkItemResponseDto>(client, $"/get-work-item/{id}");
        item.ShouldNotBeNull();
        item.Data["title"]!.GetValue<string>().ShouldBe("after");
        item.Status.ShouldBe("open");

        var list = await Query<List<ListWorkItemsApi.Response.Item>>(
            client,
            "/list-work-items",
            new { }
        );
        list.ShouldNotBeNull();
        list.ShouldContain(x => x.Id == id && !x.IsDeleted && x.Status == "open");
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
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/change-work-item-status",
                new { id = claimedId, status = "Claimed" }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var claimed = await Query<WorkItemResponseDto>(client, $"/get-work-item/{claimedId}");
        claimed.ShouldNotBeNull();
        claimed.Status.ShouldBe("claimed");

        var openList = await Query<List<ListWorkItemsApi.Response.Item>>(
            client,
            "/list-work-items",
            new { status = " Open " }
        );
        openList.ShouldNotBeNull();
        openList.ShouldContain(x => x.Id == openId);
        openList.ShouldNotContain(x => x.Id == claimedId);

        var claimedList = await Query<List<ListWorkItemsApi.Response.Item>>(
            client,
            "/list-work-items",
            new { status = "claimed" }
        );
        claimedList.ShouldNotBeNull();
        claimedList.ShouldContain(x => x.Id == claimedId);
        claimedList.ShouldNotContain(x => x.Id == openId);
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
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(client, "/change-work-item-status", new { id, status = "" })
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

    sealed record WorkItemResponseDto(
        Guid Id,
        JsonNode Data,
        string Status,
        List<WorkItemRelationshipDto> Relationships,
        bool IsDeleted
    );
}
