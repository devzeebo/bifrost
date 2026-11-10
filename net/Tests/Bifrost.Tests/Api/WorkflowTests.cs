extern alias Workflows;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.Rpc;
using Bifrost.Workflows.Contracts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Testcontainers.PostgreSql;

namespace Bifrost.Tests.Api;

public sealed class WorkflowApiFactory : WebApplicationFactory<Workflows::Program>, IAsyncLifetime
{
    readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16")
        .WithDatabase("bifrost_workflows_test")
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

[CollectionDefinition("workflows-api")]
public sealed class WorkflowApiCollection : ICollectionFixture<WorkflowApiFactory>;

[Collection("workflows-api")]
public class WorkflowTests
{
    readonly WorkflowApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public WorkflowTests(WorkflowApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task create_workflow_with_nodes_round_trips_through_get_and_list()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        var nodeId = Guid.NewGuid();
        var inputId = Guid.NewGuid();
        var outputId = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-workflow",
                new
                {
                    id = workflowId,
                    name = "bdd workflow",
                    nodes = new[]
                    {
                        new
                        {
                            id = nodeId,
                            inputs = new[] { new { id = inputId, name = "in" } },
                            outputs = new[] { new { id = outputId, name = "out" } },
                            definition = new { style = "harness", spec = new { identity = "agent" } },
                        },
                    },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var got = await Query<GetWorkflowApi.Response>(client, $"/get-workflow/{workflowId}");
        got.ShouldNotBeNull();
        got.Id.ShouldBe(workflowId);
        got.Name.ShouldBe("bdd workflow");
        got.Connections.ShouldBeEmpty();
        got.Nodes.Count.ShouldBe(1);
        got.Nodes[0].Id.ShouldBe(nodeId);
        got.Nodes[0].Definition.ShouldNotBeNull();
        got.Nodes[0].Definition!.Style.ShouldBe("harness");
        got.Nodes[0].Inputs.Single().Id.ShouldBe(inputId);
        got.Nodes[0].Outputs.Single().Id.ShouldBe(outputId);

        var list = await Query<ListWorkflowsApi.Response>(client, "/list-workflows");
        list.ShouldNotBeNull();
        list.Items.ShouldContain(x => x.Id == workflowId && x.Name == "bdd workflow");
    }

    [Fact]
    public async Task save_workflow_replaces_name_and_nodes()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        var firstNodeId = Guid.NewGuid();
        var secondNodeId = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-workflow",
                new
                {
                    id = workflowId,
                    name = "draft",
                    nodes = new[]
                    {
                        new
                        {
                            id = firstNodeId,
                            inputs = Array.Empty<object>(),
                            outputs = Array.Empty<object>(),
                            definition = new { style = "script", spec = new { body = "console.log(1)" } },
                        },
                    },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (
            await Post(
                client,
                "/save-workflow",
                new
                {
                    id = workflowId,
                    name = "saved",
                    nodes = new[]
                    {
                        new
                        {
                            id = secondNodeId,
                            inputs = new[] { new { id = Guid.NewGuid(), name = "work" } },
                            outputs = new[] { new { id = Guid.NewGuid(), name = "done" } },
                            definition = new { style = "harness", spec = new { identity = "worker" } },
                        },
                    },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var got = await Query<GetWorkflowApi.Response>(client, $"/get-workflow/{workflowId}");
        got.ShouldNotBeNull();
        got.Name.ShouldBe("saved");
        got.Nodes.Count.ShouldBe(1);
        got.Nodes[0].Id.ShouldBe(secondNodeId);
        got.Nodes[0].Definition!.Style.ShouldBe("harness");
    }

    [Fact]
    public async Task save_rejects_missing_definition_with_clear_reason()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        var nodeId = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-workflow",
                new
                {
                    id = workflowId,
                    name = "draft",
                    nodes = Array.Empty<object>(),
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var response = await Post(
            client,
            "/save-workflow",
            new
            {
                id = workflowId,
                name = "draft",
                nodes = new[]
                {
                    new
                    {
                        id = nodeId,
                        inputs = Array.Empty<object>(),
                        outputs = Array.Empty<object>(),
                    },
                },
            }
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain($"Node '{nodeId}' is missing a definition.");
    }

    [Fact]
    public async Task save_rejects_unknown_definition_style_with_clear_reason()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        var nodeId = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-workflow",
                new
                {
                    id = workflowId,
                    name = "draft",
                    nodes = Array.Empty<object>(),
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var response = await Post(
            client,
            "/save-workflow",
            new
            {
                id = workflowId,
                name = "draft",
                nodes = new[]
                {
                    new
                    {
                        id = nodeId,
                        inputs = Array.Empty<object>(),
                        outputs = Array.Empty<object>(),
                        definition = new { style = "container", spec = new { } },
                    },
                },
            }
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain("Unknown definition style 'container'");
        body.ShouldContain("harness");
        body.ShouldContain("script");
    }

    [Fact]
    public async Task create_allows_empty_nodes()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-workflow",
                new
                {
                    id = workflowId,
                    name = "empty",
                    nodes = Array.Empty<object>(),
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var got = await Query<GetWorkflowApi.Response>(client, $"/get-workflow/{workflowId}");
        got.ShouldNotBeNull();
        got.Name.ShouldBe("empty");
        got.Nodes.ShouldBeEmpty();
        got.Connections.ShouldBeEmpty();
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

    static async Task<T?> Query<T>(HttpClient client, string path)
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), path)
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        };
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions);
    }
}
