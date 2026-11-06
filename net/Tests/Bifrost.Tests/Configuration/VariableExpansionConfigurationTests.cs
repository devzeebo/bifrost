using Bifrost.Configuration;
using Microsoft.Extensions.Configuration;
using Shouldly;

namespace Bifrost.Tests.Configuration;

public class VariableExpansionConfigurationTests
{
    const string ApiKeyVar = "BIFROST_TEST_API_KEY";
    const string SuffixVar = "BIFROST_TEST_SUFFIX";

    [Fact]
    public void AddVariableExpansion_expands_Ai_ApiKey_from_environment()
    {
        using var env = TemporaryEnvironment.Set(ApiKeyVar, "sk-expanded");

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["Ai:ApiKey"] = $"${{{ApiKeyVar}}}",
                    ["Ai:BaseUrl"] = "https://example.test/v1/",
                    ["Ai:Model"] = "test-model",
                }
            )
            .AddVariableExpansion()
            .Build();

        configuration["Ai:ApiKey"].ShouldBe("sk-expanded");
        configuration["Ai:BaseUrl"].ShouldBe("https://example.test/v1/");
        configuration["Ai:Model"].ShouldBe("test-model");
    }

    [Fact]
    public void AddVariableExpansion_expands_embedded_placeholders()
    {
        using var env = TemporaryEnvironment.Set(
            (ApiKeyVar, "sk"),
            (SuffixVar, "prod")
        );

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["Ai:ApiKey"] = $"prefix-${{{ApiKeyVar}}}-${{{SuffixVar}}}",
                }
            )
            .AddVariableExpansion()
            .Build();

        configuration["Ai:ApiKey"].ShouldBe("prefix-sk-prod");
    }

    [Fact]
    public void AddVariableExpansion_throws_when_environment_variable_is_missing()
    {
        Environment.SetEnvironmentVariable(ApiKeyVar, null);

        var builder = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["Ai:ApiKey"] = $"${{{ApiKeyVar}}}" }
            )
            .AddVariableExpansion();

        var ex = Should.Throw<InvalidOperationException>(() => builder.Build());
        ex.Message.ShouldContain("Ai:ApiKey");
        ex.Message.ShouldContain(ApiKeyVar);
    }

    [Fact]
    public void AddVariableExpansion_overrides_earlier_providers()
    {
        using var env = TemporaryEnvironment.Set(ApiKeyVar, "from-env");

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["Ai:ApiKey"] = "literal-first" }
            )
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["Ai:ApiKey"] = $"${{{ApiKeyVar}}}" }
            )
            .AddVariableExpansion()
            .Build();

        configuration["Ai:ApiKey"].ShouldBe("from-env");
    }

    sealed class TemporaryEnvironment : IDisposable
    {
        readonly (string Name, string? Previous)[] _entries;

        TemporaryEnvironment((string Name, string? Previous)[] entries) => _entries = entries;

        public static TemporaryEnvironment Set(string name, string value) =>
            Set((name, value));

        public static TemporaryEnvironment Set(params (string Name, string Value)[] values)
        {
            var entries = new (string Name, string? Previous)[values.Length];
            for (var i = 0; i < values.Length; i++)
            {
                var (name, value) = values[i];
                entries[i] = (name, Environment.GetEnvironmentVariable(name));
                Environment.SetEnvironmentVariable(name, value);
            }

            return new TemporaryEnvironment(entries);
        }

        public void Dispose()
        {
            foreach (var (name, previous) in _entries)
            {
                Environment.SetEnvironmentVariable(name, previous);
            }
        }
    }
}
