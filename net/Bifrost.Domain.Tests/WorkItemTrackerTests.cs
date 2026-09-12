using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost.Domain.WorkItems.Projections;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Shouldly;
using Testcontainers.PostgreSql;

namespace Bifrost.Domain.Tests;

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
    }
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
            await PostAsync(
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

        var duplicate = await PostAsync(
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
            await PostAsync(
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
            await PostAsync(
                client,
                "/create-work-item",
                new { id = workItemA, data = new { title = "A" } }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await PostAsync(
                client,
                "/create-work-item",
                new { id = workItemB, data = new { title = "B" } }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await PostAsync(
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

        var itemA = await QueryAsync<WorkItemResponseDto>(
            client,
            "/get-work-item",
            new { id = workItemA }
        );
        var itemB = await QueryAsync<WorkItemResponseDto>(
            client,
            "/get-work-item",
            new { id = workItemB }
        );

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
            await PostAsync(
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
            await PostAsync(client, "/create-work-item", new { id = workItemA, data = new { } })
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (
            await PostAsync(client, "/create-work-item", new { id = workItemB, data = new { } })
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await PostAsync(
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
            await PostAsync(
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

        var itemA = await QueryAsync<WorkItemResponseDto>(
            client,
            "/get-work-item",
            new { id = workItemA }
        );
        var itemB = await QueryAsync<WorkItemResponseDto>(
            client,
            "/get-work-item",
            new { id = workItemB }
        );

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
            await PostAsync(
                client,
                "/create-work-item",
                new { id, data = new { title = "before" } }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await PostAsync(
                client,
                "/replace-work-item-data",
                new { id, data = new { title = "after", tags = new[] { "x" } } }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var item = await QueryAsync<WorkItemResponseDto>(client, "/get-work-item", new { id });
        item.ShouldNotBeNull();
        item.Data["title"]!.GetValue<string>().ShouldBe("after");

        var list = await QueryAsync<List<WorkItemIndex.Model>>(client, "/list-work-items", new { });
        list.ShouldNotBeNull();
        list.ShouldContain(x => x.Id == id && !x.IsDeleted);
    }

    static async Task<HttpResponseMessage> PostAsync(HttpClient client, string path, object body)
    {
        var response = await client.PostAsJsonAsync(path, body);
        if (!response.IsSuccessStatusCode && response.StatusCode != HttpStatusCode.BadRequest)
        {
            var content = await response.Content.ReadAsStringAsync();
            throw new Exception($"{(int)response.StatusCode} {path}: {content}");
        }

        return response;
    }

    static async Task<T?> QueryAsync<T>(HttpClient client, string path, object body)
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
        List<WorkItemRelationshipDto> Relationships,
        bool IsDeleted
    );
}
