using Microsoft.Extensions.Configuration;

namespace Bifrost.Ai;

public sealed class AiClientOptions
{
    public const string SectionName = "Ai";
    public const string HttpClientName = "bifrost-ai";

    public required string ApiKey { get; set; }
    public required string BaseUrl { get; set; }
    public required string Model { get; set; }

    /// <summary>
    /// Reads <c>Ai:ApiKey</c>, <c>Ai:BaseUrl</c>, and <c>Ai:Model</c> from configuration.
    /// All three are required; there are no defaults or environment-variable fallbacks.
    /// </summary>
    public static AiClientOptions FromConfiguration(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        var section = configuration.GetSection(SectionName);
        return new AiClientOptions
        {
            ApiKey = Require(section, "ApiKey"),
            BaseUrl = Require(section, "BaseUrl"),
            Model = Require(section, "Model"),
        };
    }

    static string Require(IConfiguration section, string key)
    {
        var value = section[key];
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Missing Ai:{key}.");
        }

        return value.Trim();
    }
}
