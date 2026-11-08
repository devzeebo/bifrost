extern alias Orchestrator;

using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Orchestrator::Bifrost.Gateway;
using Shouldly;

namespace Bifrost.Tests.Gateway;

public class VirtualKeyQuotaClientTests
{
    [Fact]
    public async Task GetQuota_maps_snake_case_gateway_payload()
    {
        const string payload = """
            {
              "virtual_key_name": "orch-key",
              "is_active": true,
              "budgets": [
                {
                  "id": "budget-1",
                  "max_limit": 10.0,
                  "reset_duration": "1d",
                  "last_reset": "2026-11-08T00:00:00Z",
                  "current_usage": 2.5,
                  "per_model_usage": [
                    {
                      "model": "gpt-4.1",
                      "provider": "openai",
                      "total_requests": 3,
                      "total_tokens": 1200,
                      "total_cost": 2.5
                    }
                  ]
                }
              ],
              "rate_limit": {
                "id": "rl-1",
                "token_max_limit": 100000,
                "token_reset_duration": "1m",
                "token_current_usage": 500,
                "token_last_reset": "2026-11-08T12:00:00Z",
                "request_max_limit": 60,
                "request_reset_duration": "1m",
                "request_current_usage": 4,
                "request_last_reset": "2026-11-08T12:00:00Z"
              },
              "rate_limits": [],
              "provider_configs": [
                {
                  "id": 7,
                  "provider": "openai",
                  "budgets": [
                    {
                      "id": "provider-budget",
                      "max_limit": 5.0,
                      "reset_duration": "1d",
                      "last_reset": "2026-11-08T00:00:00Z",
                      "current_usage": 1.0,
                      "per_model_usage": []
                    }
                  ],
                  "rate_limit": null
                }
              ],
              "model_configs": [
                {
                  "model_name": "gpt-4.1",
                  "provider": "openai",
                  "budgets": [],
                  "rate_limit": null
                }
              ]
            }
            """;

        var client = CreateClient(HttpStatusCode.OK, payload);
        var response = await client.GetQuota();

        response.VirtualKeyName.ShouldBe("orch-key");
        response.IsActive.ShouldBeTrue();
        response.Budgets.ShouldHaveSingleItem().CurrentUsage.ShouldBe(2.5);
        response.Budgets[0].PerModelUsage.ShouldHaveSingleItem().TotalTokens.ShouldBe(1200);
        response.RateLimit.ShouldNotBeNull().TokenCurrentUsage.ShouldBe(500);
        response.ProviderConfigs.ShouldHaveSingleItem().Provider.ShouldBe("openai");
        response.ModelConfigs.ShouldHaveSingleItem().ModelName.ShouldBe("gpt-4.1");
    }

    [Fact]
    public async Task GetQuota_requires_gateway_configuration()
    {
        var client = CreateClient(
            HttpStatusCode.OK,
            "{}",
            baseUrl: string.Empty,
            virtualKey: string.Empty
        );
        var ex = await Should.ThrowAsync<VirtualKeyQuotaException>(() => client.GetQuota());
        ex.StatusCode.ShouldBe(StatusCodes.Status503ServiceUnavailable);
        ex.Message.ShouldContain("Gateway:BaseUrl");
    }

    [Fact]
    public async Task GetQuota_maps_unauthorized_to_401()
    {
        var client = CreateClient(HttpStatusCode.Unauthorized, """{"error":"nope"}""");
        var ex = await Should.ThrowAsync<VirtualKeyQuotaException>(() => client.GetQuota());
        ex.StatusCode.ShouldBe(StatusCodes.Status401Unauthorized);
        ex.Message.ShouldBe("nope");
    }

    [Fact]
    public async Task GetQuota_maps_server_errors_to_502()
    {
        var client = CreateClient(HttpStatusCode.InternalServerError, "boom");
        var ex = await Should.ThrowAsync<VirtualKeyQuotaException>(() => client.GetQuota());
        ex.StatusCode.ShouldBe(StatusCodes.Status502BadGateway);
        ex.Message.ShouldContain("500");
    }

    static VirtualKeyQuotaClient CreateClient(
        HttpStatusCode status,
        string body,
        string baseUrl = "https://gateway.test/",
        string virtualKey = "sk-test"
    )
    {
        var handler = new StubHandler(status, body);
        var factory = new StubHttpClientFactory(handler);
        var options = Options.Create(
            new GatewayOptions { BaseUrl = baseUrl, VirtualKey = virtualKey }
        );
        return new VirtualKeyQuotaClient(factory, options);
    }

    sealed class StubHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name)
        {
            return new HttpClient(handler) { BaseAddress = new Uri("https://gateway.test/") };
        }
    }

    sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        )
        {
            request.RequestUri!.AbsolutePath.ShouldBe("/api/governance/virtual-keys/quota");
            request.Headers.Authorization.ShouldNotBeNull().Parameter.ShouldBe("sk-test");

            return Task.FromResult(
                new HttpResponseMessage(status)
                {
                    Content = new StringContent(body, Encoding.UTF8, "application/json"),
                }
            );
        }
    }
}
