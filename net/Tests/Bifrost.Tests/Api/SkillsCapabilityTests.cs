extern alias Skills;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.Rpc;
using Bifrost.Skills.Contracts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Testcontainers.PostgreSql;

namespace Bifrost.Tests.Api;

public sealed class SkillsApiFactory : WebApplicationFactory<Skills::Program>, IAsyncLifetime
{
    readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .WithDatabase("bifrost_skills_test")
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

[CollectionDefinition("skills")]
public sealed class SkillsCollection : ICollectionFixture<SkillsApiFactory>;

[Collection("skills")]
public class SkillsCapabilityTests
{
    readonly SkillsApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public SkillsCapabilityTests(SkillsApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task create_get_and_list_capability()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();
        var name = $"Capability {id:N}"[..24];
        var ask = "Describe what the work should do in plain language.";

        (
            await Post(
                client,
                "/create-capability",
                new
                {
                    id,
                    name,
                    ask,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        detail.Id.ShouldBe(id);
        detail.Name.ShouldBe(name);
        detail.Ask.ShouldBe(ask);
        detail.Criteria.ShouldBeEmpty();
        detail.Evals.ShouldBeEmpty();
        detail.HasPublishedSkill.ShouldBeFalse();

        var list = await Query<ListCapabilitiesApi.Response>(client, "/list-capabilities");
        list.ShouldNotBeNull();
        list.Items.ShouldContain(x =>
            x.Id == id && x.Name == name && x.HasPublishedSkill == false
        );
    }

    [Fact]
    public async Task change_ask_and_rename_capability()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-capability",
                new
                {
                    id,
                    name = "Original name",
                    ask = "Original ask",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/change-capability-ask",
                new { id, ask = "  Amended ask for the capability.  " }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(client, "/rename-capability", new { id, name = "  Renamed capability  " })
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        detail.Ask.ShouldBe("Amended ask for the capability.");
        detail.Name.ShouldBe("Renamed capability");

        var list = await Query<ListCapabilitiesApi.Response>(client, "/list-capabilities");
        list.ShouldNotBeNull();
        list.Items.ShouldContain(x => x.Id == id && x.Name == "Renamed capability");
    }

    [Fact]
    public async Task create_rejects_blank_name_or_ask()
    {
        var client = _factory.CreateClient();

        (
            await Post(
                client,
                "/create-capability",
                new
                {
                    id = Guid.NewGuid(),
                    name = "   ",
                    ask = "A real ask",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (
            await Post(
                client,
                "/create-capability",
                new
                {
                    id = Guid.NewGuid(),
                    name = "Named",
                    ask = "",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task create_rejects_duplicate_id()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-capability",
                new
                {
                    id,
                    name = "First",
                    ask = "Ask",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/create-capability",
                new
                {
                    id,
                    name = "Second",
                    ask = "Other ask",
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task get_unknown_capability_is_bad_request()
    {
        var client = _factory.CreateClient();
        var response = await SendQuery(client, $"/get-capability/{Guid.NewGuid()}");
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
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
        var response = await SendQuery(client, path, body);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions);
    }

    static Task<HttpResponseMessage> SendQuery(HttpClient client, string path) =>
        SendQuery(client, path, new { });

    static async Task<HttpResponseMessage> SendQuery(HttpClient client, string path, object body)
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), path)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(body),
                Encoding.UTF8,
                "application/json"
            ),
        };
        return await client.SendAsync(request);
    }
}
