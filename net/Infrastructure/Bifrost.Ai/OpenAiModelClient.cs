using System.Text.Json;
using System.Text.Json.Serialization;
using Flurl.Http;
using Flurl.Http.Configuration;
using Microsoft.Extensions.Options;

namespace Bifrost.Ai;

public sealed class OpenAiModelClient(
    IFlurlClientCache clients,
    IOptionsMonitor<AiClientOptions> options
) : IModelClient
{
    public async Task<ModelResponse> CreateResponse(
        ModelRequest request,
        CancellationToken ct = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var current = options.CurrentValue;

        try
        {
            using var response = await clients
                .Get(AiClientOptions.HttpClientName)
                .Request("responses")
                .WithOAuthBearerToken(current.ApiKey)
                .WithSettings(settings =>
                    settings.JsonSerializer = new DefaultJsonSerializer(JsonOptions)
                )
                .AllowAnyHttpStatus()
                .PostJsonAsync(BuildBody(request, current), cancellationToken: ct)
                .ConfigureAwait(false);

            var payload = await response.GetStringAsync().ConfigureAwait(false);

            if (response.StatusCode is < 200 or >= 300)
            {
                throw new ModelClientException(
                    $"AI provider returned {response.StatusCode}: {Truncate(payload)}"
                )
                {
                    StatusCode = response.StatusCode,
                };
            }

            if (string.IsNullOrWhiteSpace(payload))
            {
                throw new ModelClientException("AI provider returned an empty response.");
            }

            using var document = JsonDocument.Parse(payload);
            return MapResponse(document.RootElement);
        }
        catch (ModelClientException)
        {
            throw;
        }
        catch (JsonException ex)
        {
            throw new ModelClientException(
                $"AI provider returned an invalid response: {ex.Message}",
                ex
            );
        }
        catch (FlurlHttpTimeoutException ex)
        {
            throw new ModelClientException($"AI provider request timed out: {ex.Message}", ex);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException ex)
        {
            throw new ModelClientException($"AI provider request timed out: {ex.Message}", ex);
        }
        catch (Exception ex)
        {
            throw new ModelClientException($"AI provider could not be reached: {ex.Message}", ex);
        }
    }

    static object BuildBody(ModelRequest request, AiClientOptions current)
    {
        var model = FirstNonEmpty(request.Model, current.Model);
        if (model is null)
        {
            throw new ModelClientException(
                "AI model is not configured. Set Ai:Model or provide ModelRequest.Model."
            );
        }

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
            ["model"] = model,
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

    static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return null;
    }

    static string Truncate(string value) =>
        value.Length <= 500 ? value : value[..500] + "…";

    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true,
    };
}
