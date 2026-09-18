using System.Text.Json;
using System.Text.Json.Serialization;

namespace Bifrost.Contracts;

[JsonConverter(typeof(WorkItemStatusJsonConverter))]
public readonly record struct WorkItemStatus
{
    public string Value { get; }

    public WorkItemStatus(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ContractValidationException("Status is required.");
        }

        Value = (value ?? string.Empty).Trim().ToLowerInvariant();
    }

    public bool IsEmpty => Value.Length == 0;

    public static implicit operator string(WorkItemStatus status) => status.Value;

    public static implicit operator WorkItemStatus(string value) => new(value);

    public override string ToString() => Value;
}

public sealed class WorkItemStatusJsonConverter : JsonConverter<WorkItemStatus>
{
    public override WorkItemStatus Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options
    )
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            throw new JsonException("WorkItemStatus cannot be null.");
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
            $"Unexpected token {reader.TokenType} when reading WorkItemStatus."
        );
    }

    public override void Write(
        Utf8JsonWriter writer,
        WorkItemStatus value,
        JsonSerializerOptions options
    ) => writer.WriteStringValue(value.Value);
}
