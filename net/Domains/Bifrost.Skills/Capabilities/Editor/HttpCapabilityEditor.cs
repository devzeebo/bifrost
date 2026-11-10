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
    public string? Model { get; set; }
}

/// <summary>
/// OpenAI-compatible chat completions editor. Uses <see cref="ScriptedCapabilityEditor"/>
/// only when BaseUrl/ApiKey are not configured (tests/dev). Failures never fall back to the stub.
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
        HasCredentials
            ? ComposeHttp(context, userMessage, stale: null, ct)
            : scripted.Compose(context, userMessage, ct);

    public Task<EditorTurn> Reread(
        EditorContext context,
        Proposal stale,
        CancellationToken ct
    ) =>
        HasCredentials
            ? ComposeHttp(context, "Re-read and update or withdraw this stale proposal.", stale, ct)
            : scripted.Reread(context, stale, ct);

    bool HasCredentials =>
        !string.IsNullOrWhiteSpace(_options.BaseUrl)
        && !string.IsNullOrWhiteSpace(_options.ApiKey);

    async Task<EditorTurn> ComposeHttp(
        EditorContext context,
        string userMessage,
        Proposal? stale,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(_options.Model))
        {
            throw new CapabilityEditorException(
                "CapabilityEditor:Model is required when BaseUrl and ApiKey are configured."
            );
        }

        try
        {
            var client = httpClientFactory.CreateClient("capability-editor");
            var messages = new List<object> { new { role = "system", content = SystemPrompt(context) } };
            foreach (var prior in PriorConversation(context.Messages, userMessage))
            {
                messages.Add(new { role = MapRole(prior.Role), content = prior.Text });
            }

            messages.Add(
                new
                {
                    role = "user",
                    content = stale is null
                        ? userMessage
                        : $"Stale proposal JSON:\n{JsonSerializer.Serialize(stale, JsonOptions)}\n\nUser request:\n{userMessage}",
                }
            );

            var payload = new
            {
                model = _options.Model,
                temperature = 0.2,
                response_format = new { type = "json_object" },
                messages,
            };

            using var response = await client.PostAsJsonAsync(
                "chat/completions",
                payload,
                JsonOptions,
                ct
            );
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                throw new CapabilityEditorException(
                    $"Capability editor returned {(int)response.StatusCode}: {Truncate(body)}"
                );
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            var completion = await JsonSerializer.DeserializeAsync<ChatCompletionResponse>(
                stream,
                JsonOptions,
                ct
            );
            var content =
                completion?.Choices?.FirstOrDefault()?.Message?.Content
                ?? throw new CapabilityEditorException("Capability editor returned no content.");

            var parsed =
                JsonSerializer.Deserialize<EditorJsonTurn>(content, JsonOptions)
                ?? throw new CapabilityEditorException(
                    "Capability editor returned invalid JSON."
                );

            return new EditorTurn
            {
                AssistantText = parsed.AssistantText ?? "",
                ProposalSummary = parsed.ProposalSummary,
                Effects = parsed.Effects,
                WithdrawNote = parsed.WithdrawNote,
            };
        }
        catch (CapabilityEditorException)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "HTTP capability editor failed.");
            throw new CapabilityEditorException(
                "The capability editor could not respond. Try again.",
                ex
            );
        }
    }

    static string Truncate(string value) =>
        value.Length <= 240 ? value : value[..240] + "…";

    static IEnumerable<ChatMessage> PriorConversation(
        IReadOnlyList<ChatMessage> messages,
        string currentUserMessage
    )
    {
        // Drop the current user turn if the handler already appended it, and skip system notes.
        var prior = messages
            .Where(m => m.Role is "user" or "assistant")
            .ToList();
        if (
            prior.Count > 0
            && prior[^1].Role == "user"
            && string.Equals(prior[^1].Text, currentUserMessage, StringComparison.Ordinal)
        )
        {
            prior.RemoveAt(prior.Count - 1);
        }

        const int maxMessages = 20;
        return prior.Count <= maxMessages ? prior : prior.TakeLast(maxMessages);
    }

    static string MapRole(string role) =>
        role == "assistant" ? "assistant" : "user";

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
            "Effect kinds: AmendAsk, AddCriterion, SharpenCriterion, SplitCriterion, RetireCriterion, AddEval, AmendEval, DuplicateEval, RetireEval, ReplaceSkill."
        );
        sb.AppendLine(
            "Sharpen keeps criterion identity. Split and Retire change the set. AmendEval keeps eval identity — never retire-and-recreate. DuplicateEval copies SourceEvalId onto a new EvalId with new check ids. ReplaceSkill must name servedCriterionIds."
        );
        sb.AppendLine(
            "AddEval and AmendEval carry Scenario (plain-language face), Prompt, Context, and Checks. Each Check has Id, Kind (Script|HumanReview), Statement (one plain sentence tied to the criterion wording), and Script (TypeScript source when Kind is Script; omit/null for HumanReview). AddEval requires at least one check. Checks are pass/fail only — no scores."
        );
        sb.AppendLine(
            "Script checks are authored by you behind the scenes — the person never writes or edits Script. When a criterion or eval is mechanically checkable, write Kind=Script with a deterministic TypeScript default export function check(transcript: string, context: string): boolean, and say in assistantText that the eval is ready to run. When judgment is needed, use Kind=HumanReview with Statement only."
        );
        sb.AppendLine(
            "Re-derive, same identity: when an eval Scenario changes or a criterion Statement is sharpened, rewrite each affected check's Statement and Script but keep the same check Id — never retire-and-replace for re-derive. SharpenCriterion proposals that change wording must also include AmendEval effects for every eval behind that criterion whose checks need re-deriving."
        );
        sb.AppendLine(
            "To swap Script↔HumanReview, AmendEval with the same check Id and flipped Kind (re-author Script when returning to Script)."
        );
        sb.AppendLine(
            "When SplitCriterion or RetireCriterion would leave evals behind, include RetireEval effects for each affected eval in the same proposal. Retiring the last eval behind a criterion must say so in the proposal summary."
        );
        sb.AppendLine("List every layer an edit touches in effects before the person applies.");
        sb.AppendLine(
            "Sync contract: ask, criteria, and evals are one agreement. Rewording the ask must re-read affected criteria and update their evals in the same proposal. Sharpening a criterion must amend the ask when the ask's wording came from it, and re-derive linked eval checks. Amending an eval scenario that detaches from its criterion must carry the criterion (and ask) edit too. Adding a criterion should amend the ask so it reads as if the criterion was always there, and include proving eval(s). Never silently rewrite the derived skill in ordinary sync — omit ReplaceSkill unless the person asked to edit the skill; the skill goes stale until they re-derive."
        );
        sb.AppendLine(
            "Ambiguity always proposes a choice; never silently retire wording or pick between contradictory sync updates."
        );
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
