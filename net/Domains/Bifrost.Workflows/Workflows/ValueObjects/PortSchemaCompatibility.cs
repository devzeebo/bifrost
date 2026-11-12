using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost.Workflows.Contracts;
using Json.Schema;

namespace Bifrost.Workflows.ValueObjects;

/// <summary>
/// Port linking assignability for a focused JSON Schema dialect:
/// boolean schemas; type; properties / required / additionalProperties;
/// items / prefixItems; enum / const; allOf / anyOf / oneOf.
/// Annotation-only keywords are ignored. Other constraining keywords are unsupported for linking.
/// </summary>
public static class PortSchemaCompatibility
{
    static readonly HashSet<string> AnnotationKeywords =
    [
        "title",
        "description",
        "default",
        "examples",
        "$comment",
        "$id",
        "$schema",
        "$anchor",
        "$defs",
        "definitions",
        "readOnly",
        "writeOnly",
        "deprecated",
    ];

    static readonly HashSet<string> SupportedKeywords =
    [
        "type",
        "properties",
        "required",
        "additionalProperties",
        "items",
        "prefixItems",
        "enum",
        "const",
        "allOf",
        "anyOf",
        "oneOf",
        ..AnnotationKeywords,
    ];

    public static void EnsureParseable(JsonNode? schema, WorkflowNode node, WorkflowPort port)
    {
        var nodeLabel = Label(node.Name, node.Id);
        var portLabel = Label(port.Name, port.Id);

        if (schema is null)
        {
            throw new CommandValidationException(
                $"Node '{nodeLabel}' port '{portLabel}' is missing a schema."
            );
        }

        if (schema is not JsonValue and not JsonObject)
        {
            throw new CommandValidationException(
                $"Node '{nodeLabel}' port '{portLabel}' schema must be a JSON Schema object or boolean."
            );
        }

        if (schema is JsonObject obj && ContainsRef(obj))
        {
            throw new CommandValidationException(
                $"Node '{nodeLabel}' port '{portLabel}' schema must not use '$ref' (unsupported for linking)."
            );
        }

        try
        {
            ParseWithoutRegistering(schema);
        }
        catch (Exception ex)
        {
            throw new CommandValidationException(
                $"Node '{nodeLabel}' port '{portLabel}' has an invalid JSON Schema: {ex.Message}"
            );
        }
    }

    /// <summary>
    /// Parses a schema for validity without registering <c>$id</c>/<c>$anchor</c> into the
    /// process-wide JsonSchema.Net registry (which rejects overwrites).
    /// </summary>
    public static JsonSchema ParseWithoutRegistering(JsonNode schema) =>
        JsonSchema.FromText(WithoutRegistryIds(schema).ToJsonString());

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

    static string Label(string? name, Guid id) =>
        string.IsNullOrWhiteSpace(name) ? id.ToString() : name.Trim();

    public static bool OutputSatisfiesInput(JsonNode output, JsonNode input, out string? reason)
    {
        try
        {
            AssertSupported(output, "output");
            AssertSupported(input, "input");
            if (Satisfies(output, input))
            {
                reason = null;
                return true;
            }

            reason = "output schema does not satisfy input schema";
            return false;
        }
        catch (UnsupportedSchemaException ex)
        {
            reason = ex.Message;
            return false;
        }
    }

    static bool Satisfies(JsonNode output, JsonNode input)
    {
        var o = Normalize(output);
        var i = Normalize(input);

        if (IsTrueSchema(i))
        {
            return true;
        }

        if (IsFalseSchema(o))
        {
            return true;
        }

        if (IsFalseSchema(i))
        {
            return IsFalseSchema(o);
        }

        if (IsTrueSchema(o))
        {
            return false;
        }

        if (i is JsonObject inputObj)
        {
            if (inputObj["allOf"] is JsonArray allOf)
            {
                return allOf.All(branch => branch is not null && Satisfies(o, branch));
            }

            if (inputObj["anyOf"] is JsonArray anyOf)
            {
                return anyOf.Any(branch => branch is not null && Satisfies(o, branch));
            }

            if (inputObj["oneOf"] is JsonArray oneOf)
            {
                return oneOf.Any(branch => branch is not null && Satisfies(o, branch));
            }
        }

        if (o is JsonObject outputObj)
        {
            if (outputObj["allOf"] is JsonArray outputAllOf)
            {
                // Intersection producer: accept if every branch satisfies the input
                // (conservative; may reject some valid intersections).
                return outputAllOf.All(branch => branch is not null && Satisfies(branch, i));
            }

            if (outputObj["anyOf"] is JsonArray outputAnyOf)
            {
                return outputAnyOf.All(branch => branch is not null && Satisfies(branch, i));
            }

            if (outputObj["oneOf"] is JsonArray outputOneOf)
            {
                return outputOneOf.All(branch => branch is not null && Satisfies(branch, i));
            }

            if (outputObj["const"] is JsonNode constNode)
            {
                return InstanceValidates(constNode, i);
            }

            if (outputObj["enum"] is JsonArray enumValues)
            {
                return enumValues.All(v => v is not null && InstanceValidates(v, i));
            }
        }

        return KeywordsSatisfy((JsonObject)o, (JsonObject)i);
    }

    static bool KeywordsSatisfy(JsonObject output, JsonObject input)
    {
        if (!TypesSatisfy(output, input))
        {
            return false;
        }

        if (!EnumConstSatisfy(output, input))
        {
            return false;
        }

        if (!ObjectSatisfy(output, input))
        {
            return false;
        }

        if (!ArraySatisfy(output, input))
        {
            return false;
        }

        return true;
    }

    static bool TypesSatisfy(JsonObject output, JsonObject input)
    {
        var inputTypes = ReadTypes(input);
        if (inputTypes.Count == 0)
        {
            return true;
        }

        var outputTypes = ReadTypes(output);
        if (outputTypes.Count == 0)
        {
            // Untyped output may produce values outside the input type set.
            return false;
        }

        return outputTypes.All(t => inputTypes.Any(it => TypeAssignable(t, it)));
    }

    static bool TypeAssignable(string outputType, string inputType)
    {
        if (outputType == inputType)
        {
            return true;
        }

        return outputType == "integer" && inputType == "number";
    }

    static HashSet<string> ReadTypes(JsonObject schema)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        if (schema["type"] is JsonValue value && value.TryGetValue<string>(out var single))
        {
            result.Add(single);
        }
        else if (schema["type"] is JsonArray array)
        {
            foreach (var item in array)
            {
                if (item is JsonValue v && v.TryGetValue<string>(out var t))
                {
                    result.Add(t);
                }
            }
        }

        return result;
    }

    static bool EnumConstSatisfy(JsonObject output, JsonObject input)
    {
        if (input["const"] is JsonNode inputConst)
        {
            if (output["const"] is JsonNode outputConst)
            {
                return JsonNode.DeepEquals(outputConst, inputConst);
            }

            if (output["enum"] is JsonArray outputEnum)
            {
                return outputEnum.All(v => v is not null && JsonNode.DeepEquals(v, inputConst));
            }

            return false;
        }

        if (input["enum"] is JsonArray inputEnum)
        {
            if (output["const"] is JsonNode outputConst2)
            {
                return inputEnum.Any(v => v is not null && JsonNode.DeepEquals(v, outputConst2));
            }

            if (output["enum"] is JsonArray outputEnum2)
            {
                return outputEnum2.All(ov =>
                    ov is not null && inputEnum.Any(iv => iv is not null && JsonNode.DeepEquals(ov, iv))
                );
            }

            return false;
        }

        return true;
    }

    static bool ObjectSatisfy(JsonObject output, JsonObject input)
    {
        var inputRequired = ReadRequired(input);
        var outputRequired = ReadRequired(output);
        // Output must always provide every property the input requires.
        if (!inputRequired.IsSubsetOf(outputRequired))
        {
            return false;
        }

        var inputProps = ReadProperties(input);
        var outputProps = ReadProperties(output);

        foreach (var (name, inputProp) in inputProps)
        {
            if (outputProps.TryGetValue(name, out var outputProp))
            {
                if (!Satisfies(outputProp, inputProp))
                {
                    return false;
                }
            }
            else if (IsAdditionalPropertiesClosed(output) || inputRequired.Contains(name))
            {
                // Output never produces this property, but input may still accept absence
                // unless it is required (already checked) or we need the property schema
                // only when present — absence is fine when not required.
            }
        }

        foreach (var (name, outputProp) in outputProps)
        {
            if (inputProps.TryGetValue(name, out var inputProp))
            {
                if (!Satisfies(outputProp, inputProp))
                {
                    return false;
                }
            }
            else if (input["additionalProperties"] is JsonNode inputAdditional)
            {
                if (inputAdditional is JsonValue boolVal && boolVal.TryGetValue<bool>(out var allow) && !allow)
                {
                    return false;
                }

                if (inputAdditional is JsonObject or JsonValue)
                {
                    if (!IsTrueSchema(inputAdditional) && !Satisfies(outputProp, inputAdditional))
                    {
                        return false;
                    }
                }
            }
        }

        if (output["additionalProperties"] is JsonNode outputAdditional)
        {
            if (IsFalseSchema(outputAdditional) || (outputAdditional is JsonValue ov && ov.TryGetValue<bool>(out var oa) && !oa))
            {
                return true;
            }

            if (input["additionalProperties"] is JsonNode inputAdditional2)
            {
                if (inputAdditional2 is JsonValue iv && iv.TryGetValue<bool>(out var ia) && !ia)
                {
                    return false;
                }

                if (!IsTrueSchema(inputAdditional2) && !Satisfies(outputAdditional, inputAdditional2))
                {
                    return false;
                }
            }
        }
        else if (input["additionalProperties"] is JsonValue closed && closed.TryGetValue<bool>(out var c) && !c)
        {
            // Open output may produce extra properties that closed input rejects.
            return false;
        }

        return true;
    }

    static bool ArraySatisfy(JsonObject output, JsonObject input)
    {
        var inputPrefix = ReadPrefixItems(input);
        var outputPrefix = ReadPrefixItems(output);

        for (var idx = 0; idx < inputPrefix.Count; idx++)
        {
            if (idx >= outputPrefix.Count)
            {
                break;
            }

            if (!Satisfies(outputPrefix[idx], inputPrefix[idx]))
            {
                return false;
            }
        }

        var inputItems = input["items"];
        var outputItems = output["items"];

        if (inputItems is null)
        {
            return true;
        }

        if (outputItems is null)
        {
            // Untyped remaining items may violate input items.
            return IsTrueSchema(inputItems);
        }

        return Satisfies(outputItems, inputItems);
    }

    static List<JsonNode> ReadPrefixItems(JsonObject schema)
    {
        var list = new List<JsonNode>();
        if (schema["prefixItems"] is JsonArray array)
        {
            foreach (var item in array)
            {
                if (item is not null)
                {
                    list.Add(item);
                }
            }
        }

        return list;
    }

    static Dictionary<string, JsonNode> ReadProperties(JsonObject schema)
    {
        var result = new Dictionary<string, JsonNode>(StringComparer.Ordinal);
        if (schema["properties"] is JsonObject props)
        {
            foreach (var (key, value) in props)
            {
                if (value is not null)
                {
                    result[key] = value;
                }
            }
        }

        return result;
    }

    static HashSet<string> ReadRequired(JsonObject schema)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        if (schema["required"] is JsonArray required)
        {
            foreach (var item in required)
            {
                if (item is JsonValue v && v.TryGetValue<string>(out var name))
                {
                    result.Add(name);
                }
            }
        }

        return result;
    }

    static bool IsAdditionalPropertiesClosed(JsonObject schema) =>
        schema["additionalProperties"] is JsonValue v
        && v.TryGetValue<bool>(out var allow)
        && !allow;

    static bool InstanceValidates(JsonNode instance, JsonNode schema)
    {
        var jsonSchema = ParseWithoutRegistering(schema);
        var element = JsonSerializer.SerializeToElement(instance);
        return jsonSchema.Evaluate(element).IsValid;
    }

    static JsonNode Normalize(JsonNode schema)
    {
        if (schema is JsonObject { Count: 0 })
        {
            return JsonValue.Create(true)!;
        }

        return schema;
    }

    static bool IsTrueSchema(JsonNode schema) =>
        schema is JsonValue v && v.TryGetValue<bool>(out var b) && b;

    static bool IsFalseSchema(JsonNode schema) =>
        schema is JsonValue v && v.TryGetValue<bool>(out var b) && !b;

    static void AssertSupported(JsonNode schema, string role)
    {
        switch (schema)
        {
            case JsonValue:
                return;
            case JsonObject obj:
                foreach (var key in obj.Select(p => p.Key))
                {
                    if (!SupportedKeywords.Contains(key))
                    {
                        throw new UnsupportedSchemaException(
                            $"{role} schema keyword '{key}' is not supported for linking"
                        );
                    }
                }

                if (obj["properties"] is JsonObject props)
                {
                    foreach (var prop in props)
                    {
                        if (prop.Value is not null)
                        {
                            AssertSupported(prop.Value, role);
                        }
                    }
                }

                if (obj["additionalProperties"] is JsonNode additional and not JsonValue)
                {
                    AssertSupported(additional, role);
                }

                if (obj["items"] is JsonNode items)
                {
                    AssertSupported(items, role);
                }

                if (obj["prefixItems"] is JsonArray prefix)
                {
                    foreach (var item in prefix)
                    {
                        if (item is not null)
                        {
                            AssertSupported(item, role);
                        }
                    }
                }

                foreach (var combinator in new[] { "allOf", "anyOf", "oneOf" })
                {
                    if (obj[combinator] is JsonArray branches)
                    {
                        foreach (var branch in branches)
                        {
                            if (branch is not null)
                            {
                                AssertSupported(branch, role);
                            }
                        }
                    }
                }

                return;
            default:
                throw new UnsupportedSchemaException(
                    $"{role} schema must be a JSON Schema object or boolean"
                );
        }
    }

    static bool ContainsRef(JsonObject obj)
    {
        if (obj.ContainsKey("$ref"))
        {
            return true;
        }

        foreach (var (_, value) in obj)
        {
            switch (value)
            {
                case JsonObject child when ContainsRef(child):
                    return true;
                case JsonArray array:
                    foreach (var item in array)
                    {
                        if (item is JsonObject arrayChild && ContainsRef(arrayChild))
                        {
                            return true;
                        }
                    }

                    break;
            }
        }

        return false;
    }

    sealed class UnsupportedSchemaException(string message) : Exception(message);
}
