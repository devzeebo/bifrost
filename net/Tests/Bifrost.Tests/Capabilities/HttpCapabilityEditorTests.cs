extern alias Skills;

using System.Net;
using System.Text;
using Bifrost.Skills.Contracts;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shouldly;
using Skills::Bifrost.Capabilities.Editor;

namespace Bifrost.Tests.Capabilities;

public class HttpCapabilityEditorTests
{
    [Fact]
    public async Task http_failure_surfaces_error_instead_of_scripted_fallback()
    {
        var editor = CreateEditor(
            new StubHandler(HttpStatusCode.InternalServerError, "boom"),
            model: "test-model"
        );

        var ex = await Should.ThrowAsync<CapabilityEditorException>(() =>
            editor.Compose(SampleContext(), "reword ask: A clearer ask.", CancellationToken.None)
        );

        ex.Message.ShouldContain("500");
    }

    [Fact]
    public async Task missing_model_with_credentials_surfaces_error_instead_of_scripted_fallback()
    {
        var editor = CreateEditor(
            new StubHandler(HttpStatusCode.OK, "{}"),
            model: null
        );

        var ex = await Should.ThrowAsync<CapabilityEditorException>(() =>
            editor.Compose(SampleContext(), "reword ask: A clearer ask.", CancellationToken.None)
        );

        ex.Message.ShouldContain("Model is required");
    }

    [Fact]
    public async Task without_credentials_uses_scripted_editor()
    {
        var editor = CreateEditor(
            new StubHandler(HttpStatusCode.OK, "{}"),
            model: "test-model",
            baseUrl: null,
            apiKey: null
        );

        var turn = await editor.Compose(
            SampleContext(),
            "reword ask: A clearer ask.",
            CancellationToken.None
        );

        turn.Effects.ShouldNotBeNull();
        turn.Effects!.ShouldContain(e => e.Kind == "AmendAsk");
    }

    static HttpCapabilityEditor CreateEditor(
        HttpMessageHandler handler,
        string? model,
        string? baseUrl = "https://editor.test/",
        string? apiKey = "test-key"
    )
    {
        var factory = new StubHttpClientFactory(handler);
        var options = Options.Create(
            new CapabilityEditorOptions
            {
                BaseUrl = baseUrl,
                ApiKey = apiKey,
                Model = model,
            }
        );
        return new HttpCapabilityEditor(
            factory,
            options,
            NullLogger<HttpCapabilityEditor>.Instance,
            new ScriptedCapabilityEditor()
        );
    }

    static EditorContext SampleContext() =>
        new()
        {
            CapabilityId = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Name = "Draft replies",
            Ask = "Write clear customer replies.",
            Criteria = [],
            Evals = [],
            SkillMarkdown = "",
            Messages = [],
        };

    sealed class StubHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) =>
            new(handler) { BaseAddress = new Uri("https://editor.test/") };
    }

    sealed class StubHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken
        ) =>
            Task.FromResult(
                new HttpResponseMessage(status)
                {
                    Content = new StringContent(body, Encoding.UTF8, "application/json"),
                }
            );
    }
}
