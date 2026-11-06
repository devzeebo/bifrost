using Microsoft.Extensions.Configuration;

namespace Bifrost.Configuration;

sealed class VariableExpansionConfigurationSource(IConfigurationBuilder builder) : IConfigurationSource
{
    public IConfigurationProvider Build(IConfigurationBuilder _) =>
        new VariableExpansionConfigurationProvider(builder);
}
