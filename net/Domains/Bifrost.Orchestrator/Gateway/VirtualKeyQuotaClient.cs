using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Bifrost.Orchestrator.Contracts;
using Microsoft.Extensions.Options;

namespace Bifrost.Gateway;

public sealed class VirtualKeyQuotaClient(
    IHttpClientFactory httpClientFactory,
    IOptions<GatewayOptions> options
) : IVirtualKeyQuotaClient
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task<GetVirtualKeyQuotaApi.Response> GetQuota(CancellationToken ct = default)
    {
        var current = options.Value;
        if (!current.IsConfigured)
        {
            throw new VirtualKeyQuotaException(
                "Gateway:BaseUrl and Gateway:VirtualKey are required for quota lookups.",
                StatusCodes.Status503ServiceUnavailable
            );
        }

        var client = httpClientFactory.CreateClient(GatewayOptions.HttpClientName);

        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                "api/governance/virtual-keys/quota"
            );
            request.Headers.Authorization = new AuthenticationHeaderValue(
                "Bearer",
                current.VirtualKey
            );

            using var response = await client.SendAsync(request, ct).ConfigureAwait(false);
            var payload = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

            if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized)
            {
                throw new VirtualKeyQuotaException(
                    ExtractError(payload) ?? "Missing or invalid virtual key.",
                    StatusCodes.Status401Unauthorized
                );
            }

            if (response.StatusCode is System.Net.HttpStatusCode.Forbidden)
            {
                throw new VirtualKeyQuotaException(
                    ExtractError(payload) ?? "Virtual key has expired.",
                    StatusCodes.Status403Forbidden
                );
            }

            if ((int)response.StatusCode is < 200 or >= 300)
            {
                throw new VirtualKeyQuotaException(
                    $"Gateway returned {(int)response.StatusCode}: {Truncate(payload)}",
                    StatusCodes.Status502BadGateway
                );
            }

            if (string.IsNullOrWhiteSpace(payload))
            {
                throw new VirtualKeyQuotaException(
                    "Gateway returned an empty quota response.",
                    StatusCodes.Status502BadGateway
                );
            }

            var upstream =
                JsonSerializer.Deserialize<UpstreamQuotaResponse>(payload, JsonOptions)
                ?? throw new VirtualKeyQuotaException(
                    "Gateway returned an invalid quota response.",
                    StatusCodes.Status502BadGateway
                );

            return Map(upstream);
        }
        catch (VirtualKeyQuotaException)
        {
            throw;
        }
        catch (JsonException ex)
        {
            throw new VirtualKeyQuotaException(
                $"Gateway returned an invalid quota response: {ex.Message}",
                StatusCodes.Status502BadGateway,
                ex
            );
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new VirtualKeyQuotaException(
                $"Gateway quota request failed: {ex.Message}",
                StatusCodes.Status502BadGateway,
                ex
            );
        }
    }

    static GetVirtualKeyQuotaApi.Response Map(UpstreamQuotaResponse upstream) =>
        new()
        {
            VirtualKeyName = upstream.VirtualKeyName ?? string.Empty,
            IsActive = upstream.IsActive,
            Budgets = MapBudgets(upstream.Budgets),
            RateLimit = MapRateLimit(upstream.RateLimit),
            RateLimits = (upstream.RateLimits ?? []).Select(MapRateLimitRequired).ToArray(),
            ProviderConfigs = (upstream.ProviderConfigs ?? [])
                .Select(MapProviderConfig)
                .ToArray(),
            ModelConfigs = (upstream.ModelConfigs ?? []).Select(MapModelConfig).ToArray(),
        };

    static IReadOnlyList<GetVirtualKeyQuotaApi.Budget> MapBudgets(
        IReadOnlyList<UpstreamBudget>? budgets
    ) => (budgets ?? []).Select(MapBudget).ToArray();

    static GetVirtualKeyQuotaApi.Budget MapBudget(UpstreamBudget budget) =>
        new()
        {
            Id = budget.Id ?? string.Empty,
            MaxLimit = budget.MaxLimit,
            ResetDuration = budget.ResetDuration ?? string.Empty,
            LastReset = budget.LastReset,
            CurrentUsage = budget.CurrentUsage,
            PerModelUsage = (budget.PerModelUsage ?? []).Select(MapModelUsage).ToArray(),
            SourceType = budget.SourceType,
            SourceId = budget.SourceId,
            SourceName = budget.SourceName,
        };

    static GetVirtualKeyQuotaApi.ModelUsage MapModelUsage(UpstreamModelUsage usage) =>
        new()
        {
            Model = usage.Model ?? string.Empty,
            Provider = usage.Provider,
            TotalRequests = usage.TotalRequests,
            TotalTokens = usage.TotalTokens,
            TotalCost = usage.TotalCost,
        };

    static GetVirtualKeyQuotaApi.RateLimit? MapRateLimit(UpstreamRateLimit? rateLimit) =>
        rateLimit is null ? null : MapRateLimitRequired(rateLimit);

    static GetVirtualKeyQuotaApi.RateLimit MapRateLimitRequired(UpstreamRateLimit rateLimit) =>
        new()
        {
            Id = rateLimit.Id ?? string.Empty,
            TokenMaxLimit = rateLimit.TokenMaxLimit,
            TokenResetDuration = rateLimit.TokenResetDuration,
            TokenCurrentUsage = rateLimit.TokenCurrentUsage,
            TokenLastReset = rateLimit.TokenLastReset,
            RequestMaxLimit = rateLimit.RequestMaxLimit,
            RequestResetDuration = rateLimit.RequestResetDuration,
            RequestCurrentUsage = rateLimit.RequestCurrentUsage,
            RequestLastReset = rateLimit.RequestLastReset,
            SourceType = rateLimit.SourceType,
            SourceId = rateLimit.SourceId,
            SourceName = rateLimit.SourceName,
        };

    static GetVirtualKeyQuotaApi.ProviderConfig MapProviderConfig(UpstreamProviderConfig config) =>
        new()
        {
            Id = config.Id,
            Provider = config.Provider ?? string.Empty,
            Budgets = MapBudgets(config.Budgets),
            RateLimit = MapRateLimit(config.RateLimit),
        };

    static GetVirtualKeyQuotaApi.ModelConfig MapModelConfig(UpstreamModelConfig config) =>
        new()
        {
            ModelName = config.ModelName ?? string.Empty,
            Provider = config.Provider,
            Budgets = MapBudgets(config.Budgets),
            RateLimit = MapRateLimit(config.RateLimit),
        };

    static string? ExtractError(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(payload);
            if (
                document.RootElement.TryGetProperty("error", out var error)
                && error.ValueKind == JsonValueKind.String
            )
            {
                return error.GetString();
            }
        }
        catch (JsonException)
        {
            // Fall through to truncation.
        }

        return Truncate(payload);
    }

    static string Truncate(string value) =>
        value.Length <= 200 ? value : value[..200] + "…";

    sealed record UpstreamQuotaResponse
    {
        public string? VirtualKeyName { get; init; }
        public bool IsActive { get; init; }
        public IReadOnlyList<UpstreamBudget>? Budgets { get; init; }
        public UpstreamRateLimit? RateLimit { get; init; }
        public IReadOnlyList<UpstreamRateLimit>? RateLimits { get; init; }
        public IReadOnlyList<UpstreamProviderConfig>? ProviderConfigs { get; init; }
        public IReadOnlyList<UpstreamModelConfig>? ModelConfigs { get; init; }
    }

    sealed record UpstreamBudget
    {
        public string? Id { get; init; }
        public double MaxLimit { get; init; }
        public string? ResetDuration { get; init; }
        public DateTimeOffset LastReset { get; init; }
        public double CurrentUsage { get; init; }
        public IReadOnlyList<UpstreamModelUsage>? PerModelUsage { get; init; }
        public string? SourceType { get; init; }
        public string? SourceId { get; init; }
        public string? SourceName { get; init; }
    }

    sealed record UpstreamModelUsage
    {
        public string? Model { get; init; }
        public string? Provider { get; init; }
        public long TotalRequests { get; init; }
        public long TotalTokens { get; init; }
        public double TotalCost { get; init; }
    }

    sealed record UpstreamRateLimit
    {
        public string? Id { get; init; }
        public long? TokenMaxLimit { get; init; }
        public string? TokenResetDuration { get; init; }
        public long TokenCurrentUsage { get; init; }
        public DateTimeOffset TokenLastReset { get; init; }
        public long? RequestMaxLimit { get; init; }
        public string? RequestResetDuration { get; init; }
        public long RequestCurrentUsage { get; init; }
        public DateTimeOffset RequestLastReset { get; init; }
        public string? SourceType { get; init; }
        public string? SourceId { get; init; }
        public string? SourceName { get; init; }
    }

    sealed record UpstreamProviderConfig
    {
        public int Id { get; init; }
        public string? Provider { get; init; }
        public IReadOnlyList<UpstreamBudget>? Budgets { get; init; }
        public UpstreamRateLimit? RateLimit { get; init; }
    }

    sealed record UpstreamModelConfig
    {
        public string? ModelName { get; init; }
        public string? Provider { get; init; }
        public IReadOnlyList<UpstreamBudget>? Budgets { get; init; }
        public UpstreamRateLimit? RateLimit { get; init; }
    }
}
