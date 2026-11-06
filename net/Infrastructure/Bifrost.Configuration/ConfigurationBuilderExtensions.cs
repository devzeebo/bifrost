using Microsoft.Extensions.Configuration;

namespace Bifrost.Configuration;

public static class ConfigurationBuilderExtensions
{
    extension(IConfigurationBuilder builder)
    {
        /// <summary>
        /// Expands <c>${ENV_VAR}</c> placeholders in configuration values using process environment
        /// variables. Register last so expanded values override earlier sources.
        /// </summary>
        public IConfigurationBuilder AddVariableExpansion()
        {
            ArgumentNullException.ThrowIfNull(builder);
            return builder.Add(new VariableExpansionConfigurationSource(builder));
        }
    }
}
