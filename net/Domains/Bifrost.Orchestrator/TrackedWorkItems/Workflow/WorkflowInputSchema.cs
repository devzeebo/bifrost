using System.Text.Json;
using System.Text.Json.Nodes;
using Json.Schema;

namespace Bifrost.TrackedWorkItems.Workflow;

public static class WorkflowInputSchema
{
    public static bool Satisfies(JsonNode? instance, JsonNode schema) =>
        TryEvaluate(instance, schema, out _);

    public static bool TryEvaluate(
        JsonNode? instance,
        JsonNode schema,
        out string? detail
    )
    {
        ArgumentNullException.ThrowIfNull(schema);

        if (schema is JsonValue value && value.TryGetValue<bool>(out var allowAll))
        {
            detail = allowAll ? null : "schema is false";
            return allowAll;
        }

        // Avoid process-wide JsonSchema.Net registry collisions across schemas with $id.
        // Strip only top-level $id/$anchor (same as PortSchemaCompatibility.WithoutRegistryIds).
        var text = WithoutRegistryIds(schema).ToJsonString();
        var jsonSchema = JsonSchema.FromText(text);
        var element = JsonSerializer.SerializeToElement(instance ?? JsonValue.Create((string?)null)!);
        var result = jsonSchema.Evaluate(
            element,
            new EvaluationOptions { OutputFormat = OutputFormat.List }
        );
        if (result.IsValid)
        {
            detail = null;
            return true;
        }

        detail = FormatEvaluationDetail(result);
        return false;
    }

    static JsonNode WithoutRegistryIds(JsonNode schema)
    {
        var clone = schema.DeepClone()!;
        if (clone is JsonObject obj)
        {
            obj.Remove("$id");
            obj.Remove("$anchor");
        }

        return clone;
    }

    static string FormatEvaluationDetail(EvaluationResults result)
    {
        var parts = new List<string>();
        CollectDetails(result, parts);
        return parts.Count == 0
            ? "instance does not satisfy schema"
            : string.Join("; ", parts.Take(5));
    }

    static void CollectDetails(EvaluationResults result, List<string> parts)
    {
        if (result.Errors is { Count: > 0 })
        {
            foreach (var error in result.Errors.Values.Take(5))
            {
                if (!string.IsNullOrWhiteSpace(error))
                {
                    parts.Add(error);
                }
            }
        }

        if (result.Details is null)
        {
            return;
        }

        foreach (var child in result.Details)
        {
            if (!child.IsValid)
            {
                CollectDetails(child, parts);
            }
        }
    }
}
