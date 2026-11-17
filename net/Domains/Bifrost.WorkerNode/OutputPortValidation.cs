using System.Text.Json;
using System.Text.Json.Nodes;
using Json.Schema;

namespace Bifrost.WorkerNode;

public sealed record OutputPortSpec(Guid Id, string Name, JsonNode Schema);

public static class OutputPortValidation
{
    public const string OutputsFileName = "outputs.json";

    public static IReadOnlyList<OutputPortSpec> ReadPortsFromIssuedData(JsonNode data)
    {
        if (data is not JsonObject root)
        {
            return [];
        }

        if (
            !root.TryGetPropertyValue("node", out var nodeNode)
            || nodeNode is not JsonObject node
        )
        {
            return [];
        }

        if (
            !node.TryGetPropertyValue("outputs", out var outputsNode)
            || outputsNode is not JsonArray outputs
        )
        {
            return [];
        }

        var ports = new List<OutputPortSpec>();
        foreach (var item in outputs)
        {
            if (item is not JsonObject port)
            {
                continue;
            }

            if (
                !port.TryGetPropertyValue("id", out var idNode)
                || idNode is null
                || idNode.GetValueKind() != JsonValueKind.String
                || !Guid.TryParse(idNode.GetValue<string>(), out var id)
            )
            {
                continue;
            }

            var name =
                port.TryGetPropertyValue("name", out var nameNode)
                && nameNode is not null
                && nameNode.GetValueKind() == JsonValueKind.String
                    ? nameNode.GetValue<string>()
                    : id.ToString("D");

            var schema =
                port.TryGetPropertyValue("schema", out var schemaNode) && schemaNode is not null
                    ? schemaNode.DeepClone()!
                    : JsonValue.Create(true)!;

            ports.Add(new OutputPortSpec(id, name, schema));
        }

        return ports;
    }

    /// <summary>
    /// Maps a script/harness return value onto declared output ports.
    /// Explicit <c>outputs</c> object: fill by port name then id; missing port fails.
    /// Bare return (no outputs key): the whole value lands on every port.
    /// </summary>
    public static bool TryMapAndValidate(
        JsonNode? returned,
        IReadOnlyList<OutputPortSpec> ports,
        out JsonObject workItemOutputs,
        out string? failureReason
    )
    {
        workItemOutputs = new JsonObject();
        failureReason = null;

        // No declared ports: ignore any return and leave work-item data unchanged.
        if (ports.Count == 0)
        {
            return true;
        }

        JsonObject? named = null;
        if (
            returned is JsonObject returnedObject
            && returnedObject.TryGetPropertyValue("outputs", out var explicitOutputs)
            && explicitOutputs is JsonObject outputsObject
        )
        {
            named = outputsObject;
        }

        if (named is not null)
        {
            var mapped = new JsonObject();
            foreach (var port in ports)
            {
                JsonNode? value = null;
                if (named.TryGetPropertyValue(port.Name, out var byName))
                {
                    value = byName;
                }
                else if (named.TryGetPropertyValue(port.Id.ToString("D"), out var byId))
                {
                    value = byId;
                }
                else
                {
                    failureReason = $"output port '{port.Name}' was not filled by the return";
                    return false;
                }

                if (!Satisfies(value, port.Schema, out var detail))
                {
                    failureReason =
                        $"output port '{port.Name}' does not satisfy its schema"
                        + (detail is null ? "" : $": {detail}");
                    return false;
                }

                mapped[port.Id.ToString("D")] = value?.DeepClone();
            }

            workItemOutputs["outputs"] = mapped;
            return true;
        }

        // Bare return: whole value on every port.
        foreach (var port in ports)
        {
            if (!Satisfies(returned, port.Schema, out var detail))
            {
                failureReason =
                    $"output port '{port.Name}' does not satisfy its schema"
                    + (detail is null ? "" : $": {detail}");
                return false;
            }
        }

        // Null bare return: explicit per-port nulls so Advance keeps nullable outputs.
        if (returned is null)
        {
            var nullOutputs = new JsonObject();
            foreach (var port in ports)
            {
                nullOutputs[port.Id.ToString("D")] = null;
            }

            workItemOutputs["outputs"] = nullOutputs;
            return true;
        }

        workItemOutputs["bare"] = returned.DeepClone()!;
        return true;
    }

    public static bool Satisfies(JsonNode? instance, JsonNode schema, out string? detail)
    {
        if (schema is JsonValue value && value.TryGetValue<bool>(out var allowAll))
        {
            detail = allowAll ? null : "schema is false";
            return allowAll;
        }

        var text = WithoutRegistryIds(schema).ToJsonString();
        var jsonSchema = JsonSchema.FromText(text);
        var element = JsonSerializer.SerializeToElement(
            instance ?? JsonValue.Create((string?)null)!
        );
        var result = jsonSchema.Evaluate(
            element,
            new EvaluationOptions { OutputFormat = OutputFormat.List }
        );
        if (result.IsValid)
        {
            detail = null;
            return true;
        }

        detail = "instance does not satisfy schema";
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

    /// <summary>
    /// Build durable work-item data for a successful return.
    /// Explicit outputs stay on the issued shape; a bare return replaces data so advance
    /// lands that value whole on every port.
    /// </summary>
    public static JsonNode BuildSucceededData(JsonNode issuedData, JsonObject mapped)
    {
        if (mapped.TryGetPropertyValue("outputs", out var outputs) && outputs is not null)
        {
            var data =
                issuedData is JsonObject issued
                    ? issued.DeepClone().AsObject()
                    : new JsonObject();
            data["outputs"] = outputs.DeepClone();
            return data;
        }

        if (mapped.ContainsKey("bare"))
        {
            var bare = mapped["bare"];
            return bare is null ? JsonValue.Create((string?)null)! : bare.DeepClone()!;
        }

        return issuedData.DeepClone()!;
    }
}
