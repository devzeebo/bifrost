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
        /// Binds <see cref="AiClientOptions"/> from the <c>Ai</c> section with
        /// <c>OPENAI_API_KEY</c> / <c>OPENAI_BASE_URL</c> fallbacks.
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

            services
                .AddHttpClient(
                    AiClientOptions.HttpClientName,
                    (sp, client) =>
                    {
                        var options = sp.GetRequiredService<IOptions<AiClientOptions>>().Value;
                        var baseUrl = string.IsNullOrWhiteSpace(options.BaseUrl)
                            ? AiClientOptions.DefaultBaseUrl
                            : options.BaseUrl;
                        if (!baseUrl.EndsWith('/'))
                        {
                            baseUrl += "/";
                        }

                        client.BaseAddress = new Uri(baseUrl);
                    }
                )
                .ConfigurePrimaryHttpMessageHandler(() =>
                    new HttpClientHandler
                    {
                        AllowAutoRedirect = false,
                    }
                );

            services.TryAddSingleton<IModelClient>(sp =>
            {
                var factory = sp.GetRequiredService<IHttpClientFactory>();
                return new OpenAiModelClient(
                    factory.CreateClient(AiClientOptions.HttpClientName),
                    sp.GetRequiredService<IOptions<AiClientOptions>>()
                );
            });

            return services;
        }
    }
}
