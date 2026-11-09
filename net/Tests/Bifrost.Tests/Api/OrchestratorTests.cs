extern alias Orchestrator;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.MessageBus;
using Orchestrator::Bifrost.Gateway;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Tests.Support;
using Bifrost.WorkItems.Contracts;
using Marten;
using Bifrost.Rpc;
using Bifrost.Tests;
using Wolverine.Runtime.Heartbeat;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Testcontainers.PostgreSql;

namespace Bifrost.Tests.Api;

public sealed class OrchestratorApiFactory : WebApplicationFactory<Orchestrator::Program>, IAsyncLifetime
{
    readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .WithDatabase("bifrost_orchestrator_test")
        .WithUsername("bifrost")
        .WithPassword("bifrost")
        .Build();

    string _connectionString = string.Empty;

    public InMemoryWorkItemLedger WorkItemLedger { get; } = new();
    public StubVirtualKeyQuotaClient VirtualKeyQuota { get; } = new();

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
        builder.UseSetting("Gateway:BaseUrl", "https://gateway.test/");
        builder.UseSetting("Gateway:VirtualKey", "sk-test");
        builder.UseSetting("Gateway:QuotaAccessToken", "test-quota-token");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IBifrostBus>();
            services.RemoveAll<IRpcHost>();
            services.RemoveAll<RpcHost>();
            services.RemoveAll<IVirtualKeyQuotaClient>();
            foreach (var descriptor in services.Where(IsRpcHostedService).ToList())
            {
                services.Remove(descriptor);
            }

            services.AddSingleton(WorkItemLedger);
            services.AddSingleton<IVirtualKeyQuotaClient>(VirtualKeyQuota);
            services.AddMessageBusHandler<ChangeWorkItemStatusApi.Command>(
                (_, command, _) =>
                {
                    WorkItemLedger.Apply(command);
                    return Task.CompletedTask;
                }
            );
            services.AddLoopbackBifrostBus();
        });
    }

    static bool IsRpcHostedService(ServiceDescriptor descriptor) =>
        descriptor.ServiceType == typeof(IHostedService)
        && descriptor.ImplementationType?.Name is "RpcHostedService";
}

public sealed class StubVirtualKeyQuotaClient : IVirtualKeyQuotaClient
{
    public GetVirtualKeyQuotaApi.Response? Response { get; set; }
    public VirtualKeyQuotaException? Exception { get; set; }

    public Task<GetVirtualKeyQuotaApi.Response> GetQuota(CancellationToken ct = default)
    {
        if (Exception is not null)
        {
            throw Exception;
        }

        return Task.FromResult(
            Response
                ?? new GetVirtualKeyQuotaApi.Response
                {
                    VirtualKeyName = "test-key",
                    IsActive = true,
                    Budgets = [],
                    RateLimit = null,
                    RateLimits = [],
                    ProviderConfigs = [],
                    ModelConfigs = [],
                }
        );
    }
}

[CollectionDefinition("orchestrator")]
public sealed class OrchestratorCollection : ICollectionFixture<OrchestratorApiFactory>;

[Collection("orchestrator")]
public class OrchestratorTests
{
    readonly OrchestratorApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public OrchestratorTests(OrchestratorApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task registration_then_heartbeat_lists_an_available_online_node()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();

        await Publish(new WorkerNodeRegistered.Command { Id = id });
        await Publish(Heartbeat(id));

        var node = (await List(client)).Where(x => x.Id == id).ShouldHaveSingleItem();
        node.IsAvailable.ShouldBeTrue();
        node.IsOnline.ShouldBeTrue();
        node.LastHeartbeatAt.ShouldNotBeNull();

        await using var session = _factory.Services.GetRequiredService<IDocumentStore>().LightweightSession();
        var events = await session.Events.FetchStreamAsync(id);
        events.Count.ShouldBe(2);
    }

    [Fact]
    public async Task heartbeat_before_registration_does_not_create_a_node()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();

        await Publish(Heartbeat(id));

        (await List(client)).ShouldNotContain(x => x.Id == id);
    }

    [Fact]
    public async Task registering_the_same_node_twice_leaves_one_node()
    {
        var client = _factory.CreateClient();
        var id = Guid.NewGuid();

        await Publish(new WorkerNodeRegistered.Command { Id = id });
        await Publish(new WorkerNodeRegistered.Command { Id = id });

        var node = (await List(client)).Where(x => x.Id == id).ShouldHaveSingleItem();
        node.IsAvailable.ShouldBeTrue();
        node.IsOnline.ShouldBeFalse();
    }

    [Fact]
    public async Task get_virtual_key_quota_returns_the_active_key_snapshot()
    {
        _factory.VirtualKeyQuota.Exception = null;
        _factory.VirtualKeyQuota.Response = new GetVirtualKeyQuotaApi.Response
        {
            VirtualKeyName = "orch-key",
            IsActive = true,
            Budgets =
            [
                new GetVirtualKeyQuotaApi.Budget
                {
                    Id = "budget-1",
                    MaxLimit = 10,
                    ResetDuration = "1d",
                    LastReset = DateTimeOffset.Parse("2026-11-08T00:00:00Z"),
                    CurrentUsage = 2.5,
                    PerModelUsage =
                    [
                        new GetVirtualKeyQuotaApi.ModelUsage
                        {
                            Model = "gpt-4.1",
                            Provider = "openai",
                            TotalRequests = 3,
                            TotalTokens = 1200,
                            TotalCost = 2.5,
                        },
                    ],
                },
            ],
            RateLimit = null,
            RateLimits = [],
            ProviderConfigs = [],
            ModelConfigs = [],
        };

        var client = _factory.CreateClient();
        var response = await QueryQuota(client);
        response.EnsureSuccessStatusCode();

        var body = (
            await response.Content.ReadFromJsonAsync<GetVirtualKeyQuotaApi.Response>(JsonOptions)
        )!;
        body.VirtualKeyName.ShouldBe("orch-key");
        body.IsActive.ShouldBeTrue();
        body.Budgets.ShouldHaveSingleItem().CurrentUsage.ShouldBe(2.5);
        body.Budgets[0].PerModelUsage.ShouldHaveSingleItem().Model.ShouldBe("gpt-4.1");
    }

    [Fact]
    public async Task get_virtual_key_quota_rejects_missing_access_token()
    {
        var client = _factory.CreateClient();
        var response = await QueryQuota(client, accessToken: null);
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var problem = (
            await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions)
        )!;
        problem.Title.ShouldBe("Quota access denied");
    }

    [Fact]
    public async Task get_virtual_key_quota_maps_gateway_auth_failures()
    {
        _factory.VirtualKeyQuota.Response = null;
        _factory.VirtualKeyQuota.Exception = new VirtualKeyQuotaException(
            "Missing or invalid virtual key.",
            StatusCodes.Status401Unauthorized
        );

        var client = _factory.CreateClient();
        var response = await QueryQuota(client);
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var problem = (
            await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions)
        )!;
        problem.Title.ShouldBe("Invalid virtual key");
        problem.Detail.ShouldBe("Missing or invalid virtual key.");
    }

    [Fact]
    public async Task get_virtual_key_quota_maps_gateway_unavailable()
    {
        _factory.VirtualKeyQuota.Response = null;
        _factory.VirtualKeyQuota.Exception = new VirtualKeyQuotaException(
            "Gateway returned 500: boom",
            StatusCodes.Status502BadGateway
        );

        var client = _factory.CreateClient();
        var response = await QueryQuota(client);
        response.StatusCode.ShouldBe(HttpStatusCode.BadGateway);

        var problem = (
            await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions)
        )!;
        problem.Title.ShouldBe("Gateway unavailable");
    }

    [Fact]
    public async Task get_virtual_key_quota_maps_gateway_not_configured()
    {
        _factory.VirtualKeyQuota.Response = null;
        _factory.VirtualKeyQuota.Exception = new VirtualKeyQuotaException(
            "Gateway:BaseUrl and Gateway:VirtualKey are required for quota lookups.",
            StatusCodes.Status503ServiceUnavailable
        );

        var client = _factory.CreateClient();
        var response = await QueryQuota(client);
        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);

        var problem = (
            await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions)
        )!;
        problem.Title.ShouldBe("Gateway not configured");
    }

    static WolverineHeartbeat Heartbeat(Guid id) =>
        new(id.ToString(), 1, DateTimeOffset.UtcNow, TimeSpan.Zero);

    async Task Publish<TEvent>(TEvent message)
        where TEvent : class
    {
        var bus = _factory.Services.GetRequiredService<IBifrostBus>();
        await bus.Publish(message);
    }

    static async Task<List<WorkerNodeDto>> List(HttpClient client)
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), "/list-worker-nodes")
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        };
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return (
            await response.Content.ReadFromJsonAsync<List<WorkerNodeDto>>(JsonOptions)
        )!;
    }

    static Task<HttpResponseMessage> QueryQuota(
        HttpClient client,
        string? accessToken = "test-quota-token"
    )
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), "/get-virtual-key-quota")
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        };
        if (accessToken is not null)
        {
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue(
                "Bearer",
                accessToken
            );
        }

        return client.SendAsync(request);
    }

    sealed record WorkerNodeDto(
        Guid Id,
        bool IsAvailable,
        bool IsOnline,
        DateTimeOffset? LastHeartbeatAt
    );
}
