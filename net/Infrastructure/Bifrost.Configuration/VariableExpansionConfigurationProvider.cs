using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;

namespace Bifrost.Configuration;

sealed partial class VariableExpansionConfigurationProvider(IConfigurationBuilder builder)
    : ConfigurationProvider
{
    public override void Load()
    {
        var intermediate = new ConfigurationBuilder();
        foreach (var source in builder.Sources)
        {
            if (source is VariableExpansionConfigurationSource)
            {
                continue;
            }

            intermediate.Add(source);
        }

        var configuration = intermediate.Build();
        var data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

        foreach (var pair in configuration.AsEnumerable())
        {
            if (pair.Value is null || !pair.Value.Contains("${", StringComparison.Ordinal))
            {
                continue;
            }

            data[pair.Key] = Expand(pair.Value, pair.Key);
        }

        Data = data;
    }

    static string Expand(string value, string key)
    {
        return PlaceholderPattern()
            .Replace(
                value,
                match =>
                {
                    var name = match.Groups[1].Value;
                    var resolved = Environment.GetEnvironmentVariable(name);
                    if (resolved is null)
                    {
                        throw new InvalidOperationException(
                            $"Configuration key '{key}' references missing environment variable '{name}'."
                        );
                    }

                    return resolved;
                }
            );
    }

    [GeneratedRegex(@"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")]
    private static partial Regex PlaceholderPattern();
}
