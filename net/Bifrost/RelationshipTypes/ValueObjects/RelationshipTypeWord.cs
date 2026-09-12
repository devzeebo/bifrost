using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bifrost.RelationshipTypes;

[JsonConverter(typeof(RelationshipTypeWordJsonConverter))]
public readonly record struct RelationshipTypeWord
{
    public string Value { get; }

    public RelationshipTypeWord(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new CommandValidationException("ForwardWord and InverseWord are required.");
        }

        Value = (value ?? string.Empty).Trim().ToLowerInvariant();
    }

    public bool IsEmpty => Value.Length == 0;

    public static implicit operator string(RelationshipTypeWord word) => word.Value;

    public static implicit operator RelationshipTypeWord(string value) => new(value);

    public override string ToString() => Value;
}

public sealed class RelationshipTypeWordJsonConverter : JsonConverter<RelationshipTypeWord>
{
    public override RelationshipTypeWord Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options
    )
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            throw new JsonException("RelationshipTypeWord cannot be null.");
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
            $"Unexpected token {reader.TokenType} when reading RelationshipTypeWord."
        );
    }

    public override void Write(
        Utf8JsonWriter writer,
        RelationshipTypeWord value,
        JsonSerializerOptions options
    ) => writer.WriteStringValue(value.Value);
}
