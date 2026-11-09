using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Microsoft.AspNetCore.Http;
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
                options.QuotaAccessToken = bound.QuotaAccessToken;
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
            services.AddMessageBusHandler<
                GetVirtualKeyQuotaApi.Query,
                GetVirtualKeyQuotaApi.Response
            >(
                async (sp, _, ct) =>
                {
                    try
                    {
                        return await sp.GetRequiredService<IVirtualKeyQuotaClient>()
                            .GetQuota(ct)
                            .ConfigureAwait(false);
                    }
                    catch (VirtualKeyQuotaException ex)
                    {
                        throw new BusException(
                            new BusError
                            {
                                Code =
                                    ex.StatusCode is StatusCodes.Status401Unauthorized
                                        or StatusCodes.Status403Forbidden
                                        or StatusCodes.Status503ServiceUnavailable
                                        ? BusErrorCodes.Validation
                                        : BusErrorCodes.Internal,
                                Message = ex.Message,
                            }
                        );
                    }
                }
            );
            return services;
        }
    }

    static string NormalizeBaseUrl(string baseUrl)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(baseUrl);
        return baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/";
    }
}
