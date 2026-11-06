using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Bifrost.Skills.Contracts;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Bifrost.Capabilities.Editor;

public sealed class CapabilityEditorOptions
{
    public const string SectionName = "CapabilityEditor";

    public string? BaseUrl { get; set; }
    public string? ApiKey { get; set; }
    public string Model { get; set; } = "accounts/fireworks/models/llama-v3p1-70b-instruct";
}

/// <summary>
/// OpenAI-compatible chat completions editor. Falls back to <see cref="ScriptedCapabilityEditor"/>
/// when BaseUrl/ApiKey are not configured.
/// </summary>
public sealed class HttpCapabilityEditor(
    IHttpClientFactory httpClientFactory,
    IOptions<CapabilityEditorOptions> options,
    ILogger<HttpCapabilityEditor> logger,
    ScriptedCapabilityEditor scripted
) : ICapabilityEditor
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    readonly CapabilityEditorOptions _options = options.Value;

    public Task<EditorTurn> Compose(
        EditorContext context,
        string userMessage,
        CancellationToken ct
    ) =>
        IsConfigured
            ? ComposeHttp(context, userMessage, stale: null, ct)
            : scripted.Compose(context, userMessage, ct);

    public Task<EditorTurn> Reread(
        EditorContext context,
        Proposal stale,
        CancellationToken ct
    ) =>
        IsConfigured
            ? ComposeHttp(context, "Re-read and update or withdraw this stale proposal.", stale, ct)
            : scripted.Reread(context, stale, ct);

    bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.BaseUrl)
        && !string.IsNullOrWhiteSpace(_options.ApiKey);

    async Task<EditorTurn> ComposeHttp(
        EditorContext context,
        string userMessage,
        Proposal? stale,
        CancellationToken ct
    )
    {
        try
        {
            var client = httpClientFactory.CreateClient("capability-editor");
            var payload = new
            {
                model = _options.Model,
                temperature = 0.2,
                response_format = new { type = "json_object" },
                messages = new object[]
                {
                    new { role = "system", content = SystemPrompt(context) },
                    new
                    {
                        role = "user",
                        content = stale is null
                            ? userMessage
                            : $"Stale proposal JSON:\n{JsonSerializer.Serialize(stale, JsonOptions)}\n\nUser request:\n{userMessage}",
                    },
                },
            };

            using var response = await client.PostAsJsonAsync(
                "chat/completions",
                payload,
                JsonOptions,
                ct
            );
            response.EnsureSuccessStatusCode();
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            var completion = await JsonSerializer.DeserializeAsync<ChatCompletionResponse>(
                stream,
                JsonOptions,
                ct
            );
            var content =
                completion?.Choices?.FirstOrDefault()?.Message?.Content
                ?? throw new InvalidOperationException("Editor returned no content.");

            var parsed =
                JsonSerializer.Deserialize<EditorJsonTurn>(content, JsonOptions)
                ?? throw new InvalidOperationException("Editor returned invalid JSON.");

            return new EditorTurn
            {
                AssistantText = parsed.AssistantText ?? "",
                ProposalSummary = parsed.ProposalSummary,
                Effects = parsed.Effects,
                WithdrawNote = parsed.WithdrawNote,
            };
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "HTTP capability editor failed; falling back to scripted editor.");
            return stale is null
                ? await scripted.Compose(context, userMessage, ct)
                : await scripted.Reread(context, stale, ct);
        }
    }

    static string SystemPrompt(EditorContext context)
    {
        var sb = new StringBuilder();
        sb.AppendLine(
            "You edit one Bifrost capability through reviewable proposals. Never publish. Never mention other capabilities or system configuration."
        );
        sb.AppendLine(
            "Respond with JSON: {\"assistantText\":string,\"proposalSummary\":string|null,\"effects\":[effect]|null,\"withdrawNote\":string|null}."
        );
        sb.AppendLine(
            "Effect kinds: AmendAsk, AddCriterion, SharpenCriterion, SplitCriterion, RetireCriterion, AddEval, AmendEval, RetireEval, ReplaceSkill."
        );
        sb.AppendLine(
            "Sharpen keeps criterion identity. Split and Retire change the set. AmendEval keeps eval identity. ReplaceSkill must name servedCriterionIds."
        );
        sb.AppendLine("List every layer an edit touches in effects before the person applies.");
        sb.AppendLine($"Capability id: {context.CapabilityId}");
        sb.AppendLine($"Name: {context.Name}");
        sb.AppendLine($"Ask: {context.Ask}");
        sb.AppendLine($"Criteria: {JsonSerializer.Serialize(context.Criteria, JsonOptions)}");
        sb.AppendLine($"Evals: {JsonSerializer.Serialize(context.Evals, JsonOptions)}");
        sb.AppendLine($"Skill markdown: {context.SkillMarkdown}");
        return sb.ToString();
    }

    sealed record ChatCompletionResponse
    {
        public List<Choice>? Choices { get; init; }
    }

    sealed record Choice
    {
        public Message? Message { get; init; }
    }

    sealed record Message
    {
        public string? Content { get; init; }
    }

    sealed record EditorJsonTurn
    {
        public string? AssistantText { get; init; }
        public string? ProposalSummary { get; init; }
        public List<ProposalEffect>? Effects { get; init; }
        public string? WithdrawNote { get; init; }
    }
}

public static class CapabilityEditorServiceCollectionExtensions
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddCapabilityEditor(IConfiguration configuration)
        {
            services.Configure<CapabilityEditorOptions>(
                configuration.GetSection(CapabilityEditorOptions.SectionName)
            );
            services.AddSingleton<ScriptedCapabilityEditor>();
            services.AddHttpClient(
                "capability-editor",
                (sp, client) =>
                {
                    var options = sp.GetRequiredService<
                        Microsoft.Extensions.Options.IOptions<CapabilityEditorOptions>
                    >().Value;
                    if (!string.IsNullOrWhiteSpace(options.BaseUrl))
                    {
                        client.BaseAddress = new Uri(
                            options.BaseUrl.EndsWith('/') ? options.BaseUrl : options.BaseUrl + "/"
                        );
                    }

                    if (!string.IsNullOrWhiteSpace(options.ApiKey))
                    {
                        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
                            "Bearer",
                            options.ApiKey
                        );
                    }
                }
            );
            services.AddSingleton<ICapabilityEditor, HttpCapabilityEditor>();
            return services;
        }
    }
}
