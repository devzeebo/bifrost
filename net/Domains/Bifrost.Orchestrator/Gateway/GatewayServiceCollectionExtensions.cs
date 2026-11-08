using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Bifrost.Gateway;

public static class GatewayServiceCollectionExtensions
{
    extension(IServiceCollection services)
    {
        public IServiceCollection AddGatewayQuota(IConfiguration configuration)
        {
            ArgumentNullException.ThrowIfNull(services);
            ArgumentNullException.ThrowIfNull(configuration);

            var bound = GatewayOptions.FromConfiguration(configuration);
            services.AddOptions<GatewayOptions>().Configure(options =>
            {
                options.BaseUrl = bound.BaseUrl;
                options.VirtualKey = bound.VirtualKey;
            });

            services.AddHttpClient(
                GatewayOptions.HttpClientName,
                (sp, client) =>
                {
                    var options = sp.GetRequiredService<IOptions<GatewayOptions>>().Value;
                    if (!options.IsConfigured)
                    {
                        return;
                    }

                    client.BaseAddress = new Uri(NormalizeBaseUrl(options.BaseUrl));
                }
            );

            services.TryAddSingleton<IVirtualKeyQuotaClient, VirtualKeyQuotaClient>();
            return services;
        }
    }

    static string NormalizeBaseUrl(string baseUrl)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(baseUrl);
        return baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/";
    }
}
