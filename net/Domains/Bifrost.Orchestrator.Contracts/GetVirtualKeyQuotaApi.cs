using Bifrost.MessageBus;

namespace Bifrost.Orchestrator.Contracts;

[BusAddress("orchestrator")]
public static class GetVirtualKeyQuotaApi
{
    public sealed record Query;

    public sealed record Response
    {
        public required string VirtualKeyName { get; init; }
        public required bool IsActive { get; init; }
        public required IReadOnlyList<Budget> Budgets { get; init; }
        public RateLimit? RateLimit { get; init; }
        public required IReadOnlyList<RateLimit> RateLimits { get; init; }
        public required IReadOnlyList<ProviderConfig> ProviderConfigs { get; init; }
        public required IReadOnlyList<ModelConfig> ModelConfigs { get; init; }
    }

    public sealed record Budget
    {
        public required string Id { get; init; }
        public required double MaxLimit { get; init; }
        public required string ResetDuration { get; init; }
        public required DateTimeOffset LastReset { get; init; }
        public required double CurrentUsage { get; init; }
        public required IReadOnlyList<ModelUsage> PerModelUsage { get; init; }
        public string? SourceType { get; init; }
        public string? SourceId { get; init; }
        public string? SourceName { get; init; }
    }

    public sealed record ModelUsage
    {
        public required string Model { get; init; }
        public string? Provider { get; init; }
        public required long TotalRequests { get; init; }
        public required long TotalTokens { get; init; }
        public required double TotalCost { get; init; }
    }

    public sealed record RateLimit
    {
        public required string Id { get; init; }
        public long? TokenMaxLimit { get; init; }
        public string? TokenResetDuration { get; init; }
        public required long TokenCurrentUsage { get; init; }
        public required DateTimeOffset TokenLastReset { get; init; }
        public long? RequestMaxLimit { get; init; }
        public string? RequestResetDuration { get; init; }
        public required long RequestCurrentUsage { get; init; }
        public required DateTimeOffset RequestLastReset { get; init; }
        public string? SourceType { get; init; }
        public string? SourceId { get; init; }
        public string? SourceName { get; init; }
    }

    public sealed record ProviderConfig
    {
        public required int Id { get; init; }
        public required string Provider { get; init; }
        public required IReadOnlyList<Budget> Budgets { get; init; }
        public RateLimit? RateLimit { get; init; }
    }

    public sealed record ModelConfig
    {
        public required string ModelName { get; init; }
        public string? Provider { get; init; }
        public required IReadOnlyList<Budget> Budgets { get; init; }
        public RateLimit? RateLimit { get; init; }
    }
}
