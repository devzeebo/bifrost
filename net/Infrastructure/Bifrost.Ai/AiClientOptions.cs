using Microsoft.Extensions.Configuration;

namespace Bifrost.Ai;

public sealed class AiClientOptions
{
    public const string SectionName = "Ai";
    public const string HttpClientName = "bifrost-ai";
    public const string DefaultBaseUrl = "https://api.openai.com/v1/";

    public string? ApiKey { get; set; }
    public string? BaseUrl { get; set; }
    public string? Model { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);

    public static AiClientOptions FromConfiguration(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var section = configuration.GetSection(SectionName);
        var apiKey = FirstNonEmpty(
            section["ApiKey"],
            configuration["OPENAI_API_KEY"],
            Environment.GetEnvironmentVariable("OPENAI_API_KEY")
        );
        var baseUrl = FirstNonEmpty(
            section["BaseUrl"],
            configuration["OPENAI_BASE_URL"],
            Environment.GetEnvironmentVariable("OPENAI_BASE_URL")
        );
        var model = FirstNonEmpty(section["Model"]);

        return new AiClientOptions
        {
            ApiKey = apiKey,
            BaseUrl = string.IsNullOrWhiteSpace(baseUrl) ? DefaultBaseUrl : baseUrl,
            Model = model,
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
}
