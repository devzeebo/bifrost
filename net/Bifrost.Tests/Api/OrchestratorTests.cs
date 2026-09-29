extern alias Orchestrator;

using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Marten;
using Bifrost.Rpc;
using Bifrost.Tests;
using Wolverine.Runtime.Heartbeat;
using Microsoft.AspNetCore.Hosting;
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
            services.RemoveAll<IBifrostBus>();
            services.RemoveAll<IRpcHost>();
            services.RemoveAll<RpcHost>();
            foreach (var descriptor in services.Where(IsRpcHostedService).ToList())
            {
                services.Remove(descriptor);
            }

            services.AddLoopbackBifrostBus();
        });
    }

    static bool IsRpcHostedService(ServiceDescriptor descriptor) =>
        descriptor.ServiceType == typeof(IHostedService)
        && descriptor.ImplementationType?.Name is "RpcHostedService";
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

    sealed record WorkerNodeDto(
        Guid Id,
        bool IsAvailable,
        bool IsOnline,
        DateTimeOffset? LastHeartbeatAt
    );
}
