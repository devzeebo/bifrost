using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Bifrost.Ai;

public sealed class OpenAiModelClient(HttpClient httpClient, IOptions<AiClientOptions> options)
    : IModelClient
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
    };

    readonly AiClientOptions _options = options.Value;

    public async Task<ModelResponse> CreateResponse(
        ModelRequest request,
        CancellationToken ct = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!_options.IsConfigured)
        {
            throw new ModelClientException(
                "AI client is not configured. Set Ai:ApiKey or OPENAI_API_KEY."
            );
        }

        try
        {
            using var message = new HttpRequestMessage(HttpMethod.Post, "responses")
            {
                Content = JsonContent.Create(BuildBody(request), options: JsonOptions),
            };
            message.Headers.Authorization = new AuthenticationHeaderValue(
                "Bearer",
                _options.ApiKey
            );

            using var response = await httpClient.SendAsync(message, ct).ConfigureAwait(false);
            var payload = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                throw new ModelClientException(
                    $"AI provider returned {(int)response.StatusCode}: {Truncate(payload)}"
                )
                {
                    StatusCode = (int)response.StatusCode,
                };
            }

            using var document = JsonDocument.Parse(
                string.IsNullOrWhiteSpace(payload) ? "{}" : payload
            );
            return MapResponse(document.RootElement);
        }
        catch (ModelClientException)
        {
            throw;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new ModelClientException($"AI provider could not be reached: {ex.Message}", ex);
        }
    }

    static object BuildBody(ModelRequest request)
    {
        var tools = request.Tools.Select(tool => new
        {
            type = "function",
            name = tool.Name,
            description = tool.Description,
            strict = tool.Strict,
            parameters = tool.Parameters,
        });

        return new Dictionary<string, object?>
        {
            ["model"] = request.Model,
            ["input"] = request.Input,
            ["store"] = false,
            ["stream"] = false,
            ["instructions"] = request.Instructions,
            ["tools"] = request.Tools.Count == 0 ? null : tools,
        };
    }

    static ModelResponse MapResponse(JsonElement root)
    {
        var status =
            root.TryGetProperty("status", out var statusProperty)
            && statusProperty.ValueKind == JsonValueKind.String
                ? statusProperty.GetString() ?? ""
                : "";

        var outputText =
            root.TryGetProperty("output_text", out var textProperty)
            && textProperty.ValueKind == JsonValueKind.String
                ? textProperty.GetString() ?? ""
                : "";

        IReadOnlyList<JsonElement> output = [];
        if (
            root.TryGetProperty("output", out var outputProperty)
            && outputProperty.ValueKind == JsonValueKind.Array
        )
        {
            output = outputProperty.EnumerateArray().Select(item => item.Clone()).ToArray();
        }

        LineUsage? usage = null;
        if (root.TryGetProperty("usage", out var usageProperty))
        {
            usage = LineUsage.Read(usageProperty);
        }

        return new ModelResponse
        {
            Status = status,
            OutputText = outputText,
            Output = output,
            Usage = usage,
        };
    }

    static string Truncate(string value) =>
        value.Length <= 500 ? value : value[..500] + "…";
}
