using Microsoft.Extensions.Configuration;

namespace Bifrost.Gateway;

public sealed class GatewayOptions
{
    public const string SectionName = "Gateway";
    public const string HttpClientName = "bifrost-gateway";

    public string BaseUrl { get; set; } = string.Empty;
    public string VirtualKey { get; set; } = string.Empty;

    /// <summary>
    /// Bearer token required on HTTP quota lookups. Empty disables the HTTP route.
    /// </summary>
    public string QuotaAccessToken { get; set; } = string.Empty;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(BaseUrl) && !string.IsNullOrWhiteSpace(VirtualKey);

    public static GatewayOptions FromConfiguration(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var section = configuration.GetSection(SectionName);
        return new GatewayOptions
        {
            BaseUrl = section["BaseUrl"]?.Trim() ?? string.Empty,
            VirtualKey = section["VirtualKey"]?.Trim() ?? string.Empty,
            QuotaAccessToken = section["QuotaAccessToken"]?.Trim() ?? string.Empty,
        };
    }
}
