using System.Text.Json;
using Bifrost.Ai;
using Shouldly;

namespace Bifrost.Tests.Ai;

public class LineUsageTests
{
    [Fact]
    public void Read_maps_response_usage_with_cache_and_cost()
    {
        var usage = LineUsage.Read(
            JsonDocument
                .Parse(
                    """
                    {
                      "input_tokens": 11,
                      "output_tokens": 4,
                      "total_tokens": 15,
                      "input_tokens_details": {
                        "cached_tokens": 7,
                        "cache_write_tokens": 2
                      },
                      "output_tokens_details": {
                        "reasoning_tokens": 1
                      },
                      "cost": 0.02
                    }
                    """
                )
                .RootElement
        );

        usage.ShouldNotBeNull();
        usage!.InputTokens.ShouldBe(11);
        usage.OutputTokens.ShouldBe(4);
        usage.TotalTokens.ShouldBe(15);
        usage.CachedTokens.ShouldBe(7);
        usage.CacheWriteTokens.ShouldBe(2);
        usage.ReasoningTokens.ShouldBe(1);
        usage.Cost.ShouldBe(0.02);
    }

    [Fact]
    public void Read_maps_chat_completions_token_names()
    {
        var usage = LineUsage.Read(
            JsonDocument
                .Parse(
                    """
                    {
                      "prompt_tokens": 8,
                      "completion_tokens": 3,
                      "total_tokens": 11
                    }
                    """
                )
                .RootElement
        );

        usage.ShouldNotBeNull();
        usage!.InputTokens.ShouldBe(8);
        usage.OutputTokens.ShouldBe(3);
        usage.TotalTokens.ShouldBe(11);
        usage.CachedTokens.ShouldBeNull();
        usage.Cost.ShouldBeNull();
    }

    [Fact]
    public void Read_returns_null_when_token_counts_are_missing()
    {
        LineUsage
            .Read(JsonDocument.Parse("""{"cost": 1}""").RootElement)
            .ShouldBeNull();
    }
}
