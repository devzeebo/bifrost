using System.Net;
using System.Text;
using System.Text.Json;
using Bifrost.Ai;
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
        var handler = new StubHandler(
            (request, _) =>
            {
                request.Method.ShouldBe(HttpMethod.Post);
                request.RequestUri!.ToString().ShouldBe("https://example.test/v1/responses");
                request.Headers.Authorization!.Parameter.ShouldBe("sk-test");

                return Task.FromResult(
                    new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = new StringContent(
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
                            """,
                            Encoding.UTF8,
                            "application/json"
                        ),
                    }
                );
            }
        );

        var client = CreateClient(handler, configured: true);
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
        handler.LastRequestBody.ShouldNotBeNull();
        handler.LastRequestBody.ShouldContain("\"model\"");
        handler.LastRequestBody.ShouldContain("\"m1\"");
        handler.LastRequestBody.ShouldContain("\"store\":false");
        handler.LastRequestBody.ShouldContain("\"stream\":false");
        handler.LastRequestBody.ShouldContain("\"instructions\"");
    }

    [Fact]
    public async Task CreateResponse_throws_when_provider_returns_non_success()
    {
        var handler = new StubHandler(
            (_, _) =>
                Task.FromResult(
                    new HttpResponseMessage(HttpStatusCode.BadGateway)
                    {
                        Content = new StringContent("upstream down"),
                    }
                )
        );

        var client = CreateClient(handler, configured: true);
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
    public async Task CreateResponse_throws_when_provider_is_unreachable()
    {
        var handler = new StubHandler(
            (_, _) => throw new HttpRequestException("connection refused")
        );

        var client = CreateClient(handler, configured: true);
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
        ex.InnerException.ShouldBeOfType<HttpRequestException>();
    }

    [Fact]
    public async Task CreateResponse_throws_when_client_is_not_configured()
    {
        var client = CreateClient(new StubHandler((_, _) => throw new InvalidOperationException()), configured: false);

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
        provider.GetRequiredService<IOptions<AiClientOptions>>().Value.Model.ShouldBe(
            "configured-model"
        );
        provider.GetRequiredService<IOptions<AiClientOptions>>().Value.IsConfigured.ShouldBeTrue();
    }

    static OpenAiModelClient CreateClient(StubHandler handler, bool configured)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://example.test/v1/"),
        };
        var options = Options.Create(
            new AiClientOptions
            {
                ApiKey = configured ? "sk-test" : null,
                BaseUrl = "https://example.test/v1/",
                Model = "m1",
            }
        );
        return new OpenAiModelClient(httpClient, options);
    }

    sealed class StubHandler(
        Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send
    ) : HttpMessageHandler
    {
        public string? LastRequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            if (request.Content is not null)
            {
                LastRequestBody = await request.Content.ReadAsStringAsync(cancellationToken);
            }

            return await send(request, cancellationToken);
        }
    }
}
