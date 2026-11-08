using Microsoft.Extensions.Configuration;

namespace Bifrost.Gateway;

public sealed class GatewayOptions
{
    public const string SectionName = "Gateway";
    public const string HttpClientName = "bifrost-gateway";

    public string BaseUrl { get; set; } = string.Empty;
    public string VirtualKey { get; set; } = string.Empty;

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
        };
    }
}
