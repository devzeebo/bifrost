using Flurl.Http;
using Flurl.Http.Configuration;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Bifrost.Ai;

public static class AiServiceCollectionExtensions
{
    extension(IServiceCollection services)
    {
        /// <summary>
        /// Registers <see cref="IModelClient"/> backed by an OpenAI-compatible Responses API client.
        /// Binds <see cref="AiClientOptions"/> from the <c>Ai</c> section
        /// (<c>ApiKey</c>, <c>BaseUrl</c>, and <c>Model</c> are all required).
        /// Options are snapshotted once at registration; configuration reloads are not applied.
        /// </summary>
        public IServiceCollection AddBifrostAi(IConfiguration configuration)
        {
            ArgumentNullException.ThrowIfNull(services);
            ArgumentNullException.ThrowIfNull(configuration);

            var bound = AiClientOptions.FromConfiguration(configuration);
            services.AddOptions<AiClientOptions>().Configure(options =>
            {
                options.ApiKey = bound.ApiKey;
                options.BaseUrl = bound.BaseUrl;
                options.Model = bound.Model;
            });

            services.AddSingleton<IFlurlClientCache>(sp =>
            {
                var options = sp.GetRequiredService<IOptions<AiClientOptions>>().Value;
                return new FlurlClientCache().Add(
                    AiClientOptions.HttpClientName,
                    NormalizeBaseUrl(options.BaseUrl),
                    builder => builder.WithAutoRedirect(false)
                );
            });

            services.TryAddSingleton<IModelClient, OpenAiModelClient>();

            return services;
        }
    }

    static string NormalizeBaseUrl(string baseUrl)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(baseUrl);
        return baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/";
    }
}
