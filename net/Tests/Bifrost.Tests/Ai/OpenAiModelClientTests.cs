using System.Net.Http;
using System.Text.Json;
using Bifrost.Ai;
using Flurl.Http;
using Flurl.Http.Configuration;
using Flurl.Http.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Shouldly;

namespace Bifrost.Tests.Ai;

public class OpenAiModelClientTests
{
    [Fact]
    public async Task CreateResponse_maps_provider_payload_and_usage()
    {
        using var httpTest = new HttpTest();
        httpTest.RespondWith(
            """
            {
              "status": "completed",
              "output_text": "hello",
              "output": [{"type": "message"}],
              "usage": {
                "input_tokens": 3,
                "output_tokens": 4,
                "total_tokens": 7
              }
            }
            """
        );

        var client = CreateClient(configured: true);
        var response = await client.CreateResponse(
            new ModelRequest
            {
                Model = "m1",
                Input = [JsonDocument.Parse("\"hi\"").RootElement.Clone()],
                Tools = [],
                SessionId = "session-1",
                Instructions = "be brief",
            }
        );

        response.Status.ShouldBe("completed");
        response.OutputText.ShouldBe("hello");
        response.Output.Count.ShouldBe(1);
        response.Usage.ShouldNotBeNull();
        response.Usage!.InputTokens.ShouldBe(3);
        response.Usage.OutputTokens.ShouldBe(4);
        response.Usage.TotalTokens.ShouldBe(7);

        httpTest
            .ShouldHaveCalled("https://example.test/v1/responses")
            .WithVerb(HttpMethod.Post)
            .WithOAuthBearerToken("sk-test")
            .WithRequestBody("*\"model\"*")
            .WithRequestBody("*\"m1\"*")
            .WithRequestBody("*\"store\":false*")
            .WithRequestBody("*\"stream\":false*")
            .WithRequestBody("*\"instructions\"*");
    }

    [Fact]
    public async Task CreateResponse_falls_back_to_configured_model()
    {
        using var httpTest = new HttpTest();
        httpTest.RespondWith("""{"status":"completed","output_text":"ok","output":[]}""");

        var client = CreateClient(configured: true, model: "configured-model");
        await client.CreateResponse(
            new ModelRequest
            {
                Input = [],
                Tools = [],
                SessionId = "session-1",
            }
        );

        httpTest
            .ShouldHaveCalled("https://example.test/v1/responses")
            .WithRequestBody("*\"configured-model\"*");
    }

    [Fact]
    public async Task CreateResponse_throws_when_model_is_not_configured()
    {
        using var httpTest = new HttpTest();
        var client = CreateClient(configured: true, model: null);

        var ex = await Should.ThrowAsync<ModelClientException>(() =>
            client.CreateResponse(
                new ModelRequest
                {
                    Input = [],
                    Tools = [],
                    SessionId = "session-1",
                }
            )
        );

        ex.Message.ShouldContain("AI model is not configured");
        httpTest.ShouldNotHaveMadeACall();
    }

    [Fact]
    public async Task CreateResponse_throws_when_provider_returns_non_success()
    {
        using var httpTest = new HttpTest();
        httpTest.RespondWith("upstream down", 502);

        var client = CreateClient(configured: true);
        var ex = await Should.ThrowAsync<ModelClientException>(() =>
            client.CreateResponse(
                new ModelRequest
                {
                    Model = "m1",
                    Input = [],
                    Tools = [],
                    SessionId = "session-1",
                }
            )
        );

        ex.StatusCode.ShouldBe(502);
        ex.Message.ShouldContain("502");
        ex.Message.ShouldContain("upstream down");
    }

    [Fact]
    public async Task CreateResponse_throws_when_provider_returns_invalid_json()
    {
        using var httpTest = new HttpTest();
        httpTest.RespondWith("not-json");

        var client = CreateClient(configured: true);
        var ex = await Should.ThrowAsync<ModelClientException>(() =>
            client.CreateResponse(
                new ModelRequest
                {
                    Model = "m1",
                    Input = [],
                    Tools = [],
                    SessionId = "session-1",
                }
            )
        );

        ex.Message.ShouldContain("invalid response");
        ex.InnerException.ShouldBeAssignableTo<JsonException>();
    }

    [Fact]
    public async Task CreateResponse_throws_when_provider_returns_empty_body()
    {
        using var httpTest = new HttpTest();
        httpTest.RespondWith("");

        var client = CreateClient(configured: true);
        var ex = await Should.ThrowAsync<ModelClientException>(() =>
            client.CreateResponse(
                new ModelRequest
                {
                    Model = "m1",
                    Input = [],
                    Tools = [],
                    SessionId = "session-1",
                }
            )
        );

        ex.Message.ShouldContain("empty response");
    }

    [Fact]
    public async Task CreateResponse_throws_when_provider_is_unreachable()
    {
        using var httpTest = new HttpTest();
        httpTest.SimulateException(new HttpRequestException("connection refused"));

        var client = CreateClient(configured: true);
        var ex = await Should.ThrowAsync<ModelClientException>(() =>
            client.CreateResponse(
                new ModelRequest
                {
                    Model = "m1",
                    Input = [],
                    Tools = [],
                    SessionId = "session-1",
                }
            )
        );

        ex.Message.ShouldContain("could not be reached");
        ex.InnerException.ShouldNotBeNull();
    }

    [Fact]
    public async Task CreateResponse_throws_timeout_when_request_is_canceled_by_http_client()
    {
        using var httpTest = new HttpTest();
        httpTest.SimulateTimeout();

        var client = CreateClient(configured: true);
        var ex = await Should.ThrowAsync<ModelClientException>(() =>
            client.CreateResponse(
                new ModelRequest
                {
                    Model = "m1",
                    Input = [],
                    Tools = [],
                    SessionId = "session-1",
                }
            )
        );

        ex.Message.ShouldContain("timed out");
        ex.InnerException.ShouldBeOfType<FlurlHttpTimeoutException>();
    }

    [Fact]
    public async Task CreateResponse_throws_when_client_is_not_configured()
    {
        using var httpTest = new HttpTest();
        var client = CreateClient(configured: false);

        var ex = await Should.ThrowAsync<ModelClientException>(() =>
            client.CreateResponse(
                new ModelRequest
                {
                    Model = "m1",
                    Input = [],
                    Tools = [],
                    SessionId = "session-1",
                }
            )
        );

        ex.Message.ShouldContain("not configured");
        httpTest.ShouldNotHaveMadeACall();
    }

    [Fact]
    public void AddBifrostAi_registers_configured_model_client()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["Ai:ApiKey"] = "sk-test",
                    ["Ai:BaseUrl"] = "https://example.test/v1/",
                    ["Ai:Model"] = "configured-model",
                }
            )
            .Build();

        var services = new ServiceCollection();
        services.AddBifrostAi(configuration);
        using var provider = services.BuildServiceProvider();

        provider.GetRequiredService<IModelClient>().ShouldBeOfType<OpenAiModelClient>();
        provider.GetRequiredService<IFlurlClientCache>().ShouldNotBeNull();
        provider.GetRequiredService<IOptions<AiClientOptions>>().Value.Model.ShouldBe(
            "configured-model"
        );
        provider.GetRequiredService<IOptions<AiClientOptions>>().Value.IsConfigured.ShouldBeTrue();
    }

    static OpenAiModelClient CreateClient(bool configured, string? model = "m1")
    {
        var clients = new FlurlClientCache().Add(
            AiClientOptions.HttpClientName,
            "https://example.test/v1/",
            builder => builder.WithAutoRedirect(false)
        );
        var options = new TestOptionsMonitor<AiClientOptions>(
            new AiClientOptions
            {
                ApiKey = configured ? "sk-test" : null,
                BaseUrl = "https://example.test/v1/",
                Model = model,
            }
        );
        return new OpenAiModelClient(clients, options);
    }

    sealed class TestOptionsMonitor<T>(T currentValue) : IOptionsMonitor<T>
    {
        public T CurrentValue => currentValue;

        public T Get(string? name) => currentValue;

        public IDisposable? OnChange(Action<T, string?> listener) => null;
    }
}
