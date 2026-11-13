using System.Text.Json;
using System.Text.Json.Nodes;
using Json.Schema;

namespace Bifrost.TrackedWorkItems.Workflow;

public static class WorkflowInputSchema
{
    public static bool Satisfies(JsonNode? instance, JsonNode schema)
    {
        ArgumentNullException.ThrowIfNull(schema);

        if (schema is JsonValue value && value.TryGetValue<bool>(out var allowAll))
        {
            return allowAll;
        }

        // Avoid process-wide JsonSchema.Net registry collisions across schemas with $id.
        var text = WithoutRegistryIds(schema).ToJsonString();
        var jsonSchema = JsonSchema.FromText(text);
        var element = JsonSerializer.SerializeToElement(instance ?? JsonValue.Create((string?)null)!);
        return jsonSchema.Evaluate(element).IsValid;
    }

    static JsonNode WithoutRegistryIds(JsonNode schema)
    {
        var clone = schema.DeepClone()!;
        StripIds(clone);
        return clone;
    }

    static void StripIds(JsonNode node)
    {
        switch (node)
        {
            case JsonObject obj:
                obj.Remove("$id");
                foreach (var child in obj.ToArray())
                {
                    if (child.Value is not null)
                    {
                        StripIds(child.Value);
                    }
                }

                break;
            case JsonArray array:
                foreach (var child in array)
                {
                    if (child is not null)
                    {
                        StripIds(child);
                    }
                }

                break;
        }
    }
}
