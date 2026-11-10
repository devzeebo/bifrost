extern alias Workflows;

using System.Text.Json.Nodes;
using Shouldly;
using Workflows::Bifrost.Workflows.ValueObjects;

namespace Bifrost.Tests.Workflows;

public class PortSchemaCompatibilityTests
{
    [Fact]
    public void true_input_accepts_any_output()
    {
        Satisfies(JsonNode.Parse("""{"type":"string"}""")!, JsonValue.Create(true)!)
            .ShouldBeTrue();
    }

    [Fact]
    public void empty_object_input_accepts_any_output()
    {
        Satisfies(JsonNode.Parse("""{"type":"number"}""")!, JsonNode.Parse("{}")!).ShouldBeTrue();
    }

    [Fact]
    public void identical_string_schemas_satisfy()
    {
        var schema = JsonNode.Parse("""{"type":"string"}""")!;
        Satisfies(schema, schema.DeepClone()).ShouldBeTrue();
    }

    [Fact]
    public void more_specific_object_output_satisfies_open_object_input()
    {
        var output = JsonNode.Parse(
            """
            {
              "type": "object",
              "properties": { "a": { "type": "string" } },
              "required": ["a"]
            }
            """
        )!;
        var input = JsonNode.Parse("""{"type":"object"}""")!;
        Satisfies(output, input).ShouldBeTrue();
    }

    [Fact]
    public void wider_output_does_not_satisfy_narrower_input()
    {
        var output = JsonNode.Parse("""{"type":["string","number"]}""")!;
        var input = JsonNode.Parse("""{"type":"string"}""")!;
        Satisfies(output, input).ShouldBeFalse();
    }

    [Fact]
    public void incompatible_primitives_do_not_satisfy()
    {
        var output = JsonNode.Parse("""{"type":"string"}""")!;
        var input = JsonNode.Parse("""{"type":"number"}""")!;
        Satisfies(output, input).ShouldBeFalse();
    }

    [Fact]
    public void integer_output_satisfies_number_input()
    {
        var output = JsonNode.Parse("""{"type":"integer"}""")!;
        var input = JsonNode.Parse("""{"type":"number"}""")!;
        Satisfies(output, input).ShouldBeTrue();
    }

    [Fact]
    public void unsupported_keyword_fails_with_reason()
    {
        var output = JsonNode.Parse("""{"type":"string","minLength":1}""")!;
        var input = JsonNode.Parse("""{"type":"string"}""")!;
        PortSchemaCompatibility
            .OutputSatisfiesInput(output, input, out var reason)
            .ShouldBeFalse();
        reason.ShouldNotBeNull();
        reason.ShouldContain("minLength");
    }

    [Fact]
    public void const_output_satisfies_matching_input_type()
    {
        var output = JsonNode.Parse("""{"const":"hello"}""")!;
        var input = JsonNode.Parse("""{"type":"string"}""")!;
        Satisfies(output, input).ShouldBeTrue();
    }

    static bool Satisfies(JsonNode output, JsonNode input) =>
        PortSchemaCompatibility.OutputSatisfiesInput(output, input, out _);
}
