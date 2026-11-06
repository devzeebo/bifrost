using System.Text.Json;

namespace Bifrost.Ai;

public sealed record LineUsage
{
    public required int InputTokens { get; init; }
    public required int OutputTokens { get; init; }
    public required int TotalTokens { get; init; }
    public int? CachedTokens { get; init; }
    public int? CacheWriteTokens { get; init; }
    public int? ReasoningTokens { get; init; }
    public double? Cost { get; init; }

    public static LineUsage? Read(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        var inputTokens = ReadNumber(value, "input_tokens") ?? ReadNumber(value, "prompt_tokens");
        var outputTokens =
            ReadNumber(value, "output_tokens") ?? ReadNumber(value, "completion_tokens");
        if (inputTokens is null || outputTokens is null)
        {
            return null;
        }

        var inputDetails =
            Details(value, "input_tokens_details") ?? Details(value, "prompt_tokens_details");
        var outputDetails = Details(value, "output_tokens_details");

        return new LineUsage
        {
            InputTokens = (int)inputTokens.Value,
            OutputTokens = (int)outputTokens.Value,
            TotalTokens = (int)(
                ReadNumber(value, "total_tokens") ?? inputTokens.Value + outputTokens.Value
            ),
            CachedTokens = ReadInt(inputDetails, "cached_tokens"),
            CacheWriteTokens = ReadInt(inputDetails, "cache_write_tokens"),
            ReasoningTokens = ReadInt(outputDetails, "reasoning_tokens"),
            Cost = ReadNumber(value, "cost"),
        };
    }

    static double? ReadNumber(JsonElement value, string propertyName)
    {
        if (
            !value.TryGetProperty(propertyName, out var property)
            || property.ValueKind != JsonValueKind.Number
        )
        {
            return null;
        }

        return property.GetDouble();
    }

    static int? ReadInt(JsonElement? value, string propertyName)
    {
        if (value is null)
        {
            return null;
        }

        var number = ReadNumber(value.Value, propertyName);
        return number is null ? null : (int)number.Value;
    }

    static JsonElement? Details(JsonElement value, string propertyName)
    {
        if (
            !value.TryGetProperty(propertyName, out var property)
            || property.ValueKind != JsonValueKind.Object
        )
        {
            return null;
        }

        return property;
    }
}
