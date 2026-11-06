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
        options.IsConfigured.ShouldBeTrue();
    }

    [Fact]
    public void FromConfiguration_falls_back_to_OpenAI_env_keys_and_default_base_url()
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

        var options = AiClientOptions.FromConfiguration(configuration);

        options.ApiKey.ShouldBe("sk-env");
        options.BaseUrl.ShouldBe("https://env.test/v1/");
        options.Model.ShouldBeNull();
        options.IsConfigured.ShouldBeTrue();
    }

    [Fact]
    public void FromConfiguration_defaults_base_url_when_unconfigured()
    {
        var options = AiClientOptions.FromConfiguration(new ConfigurationBuilder().Build());

        options.ApiKey.ShouldBeNull();
        options.BaseUrl.ShouldBe(AiClientOptions.DefaultBaseUrl);
        options.IsConfigured.ShouldBeFalse();
    }
}
