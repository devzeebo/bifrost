using Bifrost.Ai;
using Microsoft.Extensions.Configuration;
using Shouldly;

namespace Bifrost.Tests.Ai;

public class AiClientOptionsTests
{
    [Fact]
    public void FromConfiguration_binds_the_Ai_section()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["Ai:ApiKey"] = "sk-test",
                    ["Ai:BaseUrl"] = "https://example.test/v1",
                    ["Ai:Model"] = "accounts/fireworks/models/llama",
                }
            )
            .Build();

        var options = AiClientOptions.FromConfiguration(configuration);

        options.ApiKey.ShouldBe("sk-test");
        options.BaseUrl.ShouldBe("https://example.test/v1");
        options.Model.ShouldBe("accounts/fireworks/models/llama");
    }

    [Fact]
    public void FromConfiguration_ignores_root_OpenAI_keys()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["OPENAI_API_KEY"] = "sk-env",
                    ["OPENAI_BASE_URL"] = "https://env.test/v1/",
                }
            )
            .Build();

        var ex = Should.Throw<InvalidOperationException>(() =>
            AiClientOptions.FromConfiguration(configuration)
        );

        ex.Message.ShouldContain("Missing Ai:ApiKey");
    }

    [Fact]
    public void FromConfiguration_requires_all_Ai_properties()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["Ai:ApiKey"] = "sk-test",
                    ["Ai:BaseUrl"] = "https://example.test/v1/",
                }
            )
            .Build();

        var ex = Should.Throw<InvalidOperationException>(() =>
            AiClientOptions.FromConfiguration(configuration)
        );

        ex.Message.ShouldContain("Missing Ai:Model");

        Should.Throw<InvalidOperationException>(() =>
            AiClientOptions.FromConfiguration(new ConfigurationBuilder().Build())
        );
    }
}
