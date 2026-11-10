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

    static readonly object AnySchema = true;

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
                            inputs = new[]
                            {
                                new
                                {
                                    id = inputId,
                                    name = "in",
                                    schema = AnySchema,
                                },
                            },
                            outputs = new[]
                            {
                                new
                                {
                                    id = outputId,
                                    name = "out",
                                    schema = new { type = "object" },
                                },
                            },
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
        var definition = got.Nodes[0].Definition;
        definition.ShouldNotBeNull();
        definition!.Style.ShouldBe("harness");
        definition.Spec.ShouldNotBeNull();
        definition.Spec!["identity"]!.GetValue<string>().ShouldBe("agent");
        got.Nodes[0].Inputs.Single().Id.ShouldBe(inputId);
        got.Nodes[0].Inputs.Single().Schema.GetValue<bool>().ShouldBeTrue();
        got.Nodes[0].Outputs.Single().Id.ShouldBe(outputId);
        got.Nodes[0].Outputs.Single().Schema["type"]!.GetValue<string>().ShouldBe("object");

        var list = await Query<ListWorkflowsApi.Response>(client, "/list-workflows");
        list.ShouldNotBeNull();
        list.Items.ShouldContain(x => x.Id == workflowId && x.Name == "bdd workflow");
    }

    [Fact]
    public async Task create_workflow_with_compatible_connection_round_trips()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        var producerId = Guid.NewGuid();
        var consumerId = Guid.NewGuid();
        var outputId = Guid.NewGuid();
        var inputId = Guid.NewGuid();
        var connectionId = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-workflow",
                new
                {
                    id = workflowId,
                    name = "linked",
                    nodes = new[]
                    {
                        Node(
                            producerId,
                            "harness",
                            inputs: [],
                            outputs:
                            [
                                Port(
                                    outputId,
                                    "out",
                                    new
                                    {
                                        type = "object",
                                        properties = new { a = new { type = "string" } },
                                        required = new[] { "a" },
                                    }
                                ),
                            ]
                        ),
                        Node(
                            consumerId,
                            "script",
                            inputs: [Port(inputId, "in", new { type = "object" })],
                            outputs: []
                        ),
                    },
                    connections = new[]
                    {
                        new
                        {
                            id = connectionId,
                            outputPortId = outputId,
                            inputPortId = inputId,
                        },
                    },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var got = await Query<GetWorkflowApi.Response>(client, $"/get-workflow/{workflowId}");
        got.ShouldNotBeNull();
        got.Connections.Count.ShouldBe(1);
        got.Connections[0].Id.ShouldBe(connectionId);
        got.Connections[0].OutputPortId.ShouldBe(outputId);
        got.Connections[0].InputPortId.ShouldBe(inputId);
    }

    [Fact]
    public async Task create_allows_fan_out_from_one_output()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        var producerId = Guid.NewGuid();
        var consumerA = Guid.NewGuid();
        var consumerB = Guid.NewGuid();
        var outputId = Guid.NewGuid();
        var inputA = Guid.NewGuid();
        var inputB = Guid.NewGuid();

        (
            await Post(
                client,
                "/create-workflow",
                new
                {
                    id = workflowId,
                    name = "fan-out",
                    nodes = new[]
                    {
                        Node(
                            producerId,
                            "script",
                            inputs: [],
                            outputs: [Port(outputId, "out", new { type = "string" })]
                        ),
                        Node(
                            consumerA,
                            "script",
                            inputs: [Port(inputA, "in", new { type = "string" })],
                            outputs: []
                        ),
                        Node(
                            consumerB,
                            "script",
                            inputs: [Port(inputB, "in", AnySchema)],
                            outputs: []
                        ),
                    },
                    connections = new[]
                    {
                        new
                        {
                            id = Guid.NewGuid(),
                            outputPortId = outputId,
                            inputPortId = inputA,
                        },
                        new
                        {
                            id = Guid.NewGuid(),
                            outputPortId = outputId,
                            inputPortId = inputB,
                        },
                    },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var got = await Query<GetWorkflowApi.Response>(client, $"/get-workflow/{workflowId}");
        got.ShouldNotBeNull();
        got.Connections.Count.ShouldBe(2);
    }

    [Fact]
    public async Task save_rejects_incompatible_schemas()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        await CreateEmpty(client, workflowId);

        var response = await Post(
            client,
            "/save-workflow",
            new
            {
                id = workflowId,
                name = "bad-types",
                nodes = new[]
                {
                    Node(
                        Guid.NewGuid(),
                        "script",
                        inputs: [],
                        outputs: [Port(Guid.Parse("11111111-1111-1111-1111-111111111111"), "out", new { type = "string" })]
                    ),
                    Node(
                        Guid.NewGuid(),
                        "script",
                        inputs:
                        [
                            Port(
                                Guid.Parse("22222222-2222-2222-2222-222222222222"),
                                "in",
                                new { type = "number" }
                            ),
                        ],
                        outputs: []
                    ),
                },
                connections = new[]
                {
                    new
                    {
                        id = Guid.NewGuid(),
                        outputPortId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                        inputPortId = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                    },
                },
            }
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain("does not satisfy");
    }

    [Fact]
    public async Task save_rejects_unknown_port_id()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        await CreateEmpty(client, workflowId);
        var outputId = Guid.NewGuid();
        var missingInput = Guid.NewGuid();

        var response = await Post(
            client,
            "/save-workflow",
            new
            {
                id = workflowId,
                name = "missing-port",
                nodes = new[]
                {
                    Node(
                        Guid.NewGuid(),
                        "script",
                        inputs: [],
                        outputs: [Port(outputId, "out", AnySchema)]
                    ),
                },
                connections = new[]
                {
                    new
                    {
                        id = Guid.NewGuid(),
                        outputPortId = outputId,
                        inputPortId = missingInput,
                    },
                },
            }
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain(missingInput.ToString());
        body.ShouldContain("is not an input");
    }

    [Fact]
    public async Task save_rejects_fan_in_on_same_input()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        await CreateEmpty(client, workflowId);
        var outA = Guid.NewGuid();
        var outB = Guid.NewGuid();
        var inputId = Guid.NewGuid();

        var response = await Post(
            client,
            "/save-workflow",
            new
            {
                id = workflowId,
                name = "fan-in",
                nodes = new[]
                {
                    Node(
                        Guid.NewGuid(),
                        "script",
                        inputs: [],
                        outputs: [Port(outA, "a", AnySchema)]
                    ),
                    Node(
                        Guid.NewGuid(),
                        "script",
                        inputs: [],
                        outputs: [Port(outB, "b", AnySchema)]
                    ),
                    Node(
                        Guid.NewGuid(),
                        "script",
                        inputs: [Port(inputId, "in", AnySchema)],
                        outputs: []
                    ),
                },
                connections = new[]
                {
                    new
                    {
                        id = Guid.NewGuid(),
                        outputPortId = outA,
                        inputPortId = inputId,
                    },
                    new
                    {
                        id = Guid.NewGuid(),
                        outputPortId = outB,
                        inputPortId = inputId,
                    },
                },
            }
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain("already connected");
    }

    [Fact]
    public async Task save_rejects_cycles()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        await CreateEmpty(client, workflowId);
        var nodeA = Guid.NewGuid();
        var nodeB = Guid.NewGuid();
        var aOut = Guid.NewGuid();
        var aIn = Guid.NewGuid();
        var bOut = Guid.NewGuid();
        var bIn = Guid.NewGuid();

        var response = await Post(
            client,
            "/save-workflow",
            new
            {
                id = workflowId,
                name = "cycle",
                nodes = new[]
                {
                    Node(
                        nodeA,
                        "script",
                        inputs: [Port(aIn, "in", AnySchema)],
                        outputs: [Port(aOut, "out", AnySchema)]
                    ),
                    Node(
                        nodeB,
                        "script",
                        inputs: [Port(bIn, "in", AnySchema)],
                        outputs: [Port(bOut, "out", AnySchema)]
                    ),
                },
                connections = new[]
                {
                    new
                    {
                        id = Guid.NewGuid(),
                        outputPortId = aOut,
                        inputPortId = bIn,
                    },
                    new
                    {
                        id = Guid.NewGuid(),
                        outputPortId = bOut,
                        inputPortId = aIn,
                    },
                },
            }
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain("cycle");
    }

    [Fact]
    public async Task save_rejects_missing_port_schema()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        await CreateEmpty(client, workflowId);
        var nodeId = Guid.NewGuid();
        var portId = Guid.NewGuid();

        var response = await Post(
            client,
            "/save-workflow",
            new
            {
                id = workflowId,
                name = "no-schema",
                nodes = new[]
                {
                    new
                    {
                        id = nodeId,
                        inputs = new[]
                        {
                            new
                            {
                                id = portId,
                                name = "in",
                                schema = (object?)null,
                            },
                        },
                        outputs = Array.Empty<object>(),
                        definition = new { style = "script", spec = new { body = "x" } },
                    },
                },
            }
        );

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain("missing a schema");
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
                        Node(
                            firstNodeId,
                            "script",
                            inputs: [],
                            outputs: [],
                            spec: new { body = "console.log(1)" }
                        ),
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
                        Node(
                            secondNodeId,
                            "harness",
                            inputs: [Port(Guid.NewGuid(), "work", AnySchema)],
                            outputs: [Port(Guid.NewGuid(), "done", AnySchema)],
                            spec: new { identity = "worker" }
                        ),
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
        got.Connections.ShouldBeEmpty();
    }

    [Fact]
    public async Task save_rejects_missing_definition_with_clear_reason()
    {
        var client = _factory.CreateClient();
        var workflowId = Guid.NewGuid();
        var nodeId = Guid.NewGuid();

        await CreateEmpty(client, workflowId);

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

        await CreateEmpty(client, workflowId);

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

    [Fact]
    public async Task get_missing_workflow_returns_not_found()
    {
        var client = _factory.CreateClient();
        var missingId = Guid.NewGuid();

        var response = await QueryRaw(client, $"/get-workflow/{missingId}");
        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var body = await response.Content.ReadAsStringAsync();
        body.ShouldContain($"Workflow {missingId} not found.");
    }

    static async Task CreateEmpty(HttpClient client, Guid workflowId)
    {
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
    }

    static object Node(
        Guid id,
        string style,
        object[] inputs,
        object[] outputs,
        object? spec = null
    ) =>
        new
        {
            id,
            inputs,
            outputs,
            definition = new
            {
                style,
                spec = spec
                    ?? (
                        style == "harness"
                            ? (object)new { identity = "agent" }
                            : new { body = "return 1" }
                    ),
            },
        };

    static object Port(Guid id, string name, object schema) =>
        new
        {
            id,
            name,
            schema,
        };

    static async Task<HttpResponseMessage> Post(HttpClient client, string path, object body)
    {
        var response = await client.PostAsJsonAsync(path, body);
        if (
            !response.IsSuccessStatusCode
            && response.StatusCode != HttpStatusCode.BadRequest
            && response.StatusCode != HttpStatusCode.NotFound
        )
        {
            var content = await response.Content.ReadAsStringAsync();
            throw new Exception($"{(int)response.StatusCode} {path}: {content}");
        }

        return response;
    }

    static async Task<T?> Query<T>(HttpClient client, string path)
    {
        var response = await QueryRaw(client, path);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions);
    }

    static async Task<HttpResponseMessage> QueryRaw(HttpClient client, string path)
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), path)
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        };
        return await client.SendAsync(request);
    }
}
