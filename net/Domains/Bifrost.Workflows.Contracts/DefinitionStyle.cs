using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bifrost.Workflows.Contracts;

[JsonConverter(typeof(DefinitionStyleJsonConverter))]
public readonly record struct DefinitionStyle
{
    public const string Harness = "harness";
    public const string Script = "script";
    public const string WorkItemInput = "work-item-input";

    public string Value { get; }

    public DefinitionStyle(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ContractValidationException("Definition style is required.");
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized is not (Harness or Script or WorkItemInput))
        {
            throw new ContractValidationException(
                $"Unknown definition style '{value.Trim()}'. Expected '{Harness}', '{Script}', or '{WorkItemInput}'."
            );
        }

        Value = normalized;
    }

    public static implicit operator string(DefinitionStyle style) => style.Value;

    public static implicit operator DefinitionStyle(string value) => new(value);

    public override string ToString() => Value;
}

public sealed class DefinitionStyleJsonConverter : JsonConverter<DefinitionStyle>
{
    public override DefinitionStyle Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options
    )
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            throw new JsonException("Definition style cannot be null.");
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            return reader.GetString()!;
        }

        if (reader.TokenType == JsonTokenType.StartObject)
        {
            using var doc = JsonDocument.ParseValue(ref reader);
            if (doc.RootElement.TryGetProperty("value", out var value))
            {
                return value.GetString()!;
            }

            if (doc.RootElement.TryGetProperty("Value", out value))
            {
                return value.GetString()!;
            }
        }

        throw new JsonException(
            $"Unexpected token {reader.TokenType} when reading DefinitionStyle."
        );
    }

    public override void Write(
        Utf8JsonWriter writer,
        DefinitionStyle value,
        JsonSerializerOptions options
    ) => writer.WriteStringValue(value.Value);
}
