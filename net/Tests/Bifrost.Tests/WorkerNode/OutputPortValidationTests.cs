using System.Text.Json.Nodes;
using Bifrost.WorkerNode;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class OutputPortValidationTests
{
    [Fact]
    public void explicit_outputs_map_by_name_and_validate_schema()
    {
        var portId = Guid.NewGuid();
        var ports = new[]
        {
            new OutputPortSpec(
                portId,
                "outVar",
                new JsonObject { ["type"] = "number" }
            ),
        };
        var returned = new JsonObject
        {
            ["outputs"] = new JsonObject { ["outVar"] = 4 },
        };

        OutputPortValidation
            .TryMapAndValidate(returned, ports, out var mapped, out var failure)
            .ShouldBeTrue();
        failure.ShouldBeNull();
        mapped["outputs"]!["outVar"]!.GetValue<int>().ShouldBe(4);

        var data = OutputPortValidation.BuildSucceededData(
            new JsonObject { ["node"] = new JsonObject() },
            mapped
        );
        data["outputs"]!["outVar"]!.GetValue<int>().ShouldBe(4);
    }

    [Fact]
    public void missing_named_output_fails()
    {
        var ports = new[]
        {
            new OutputPortSpec(
                Guid.NewGuid(),
                "needed",
                new JsonObject { ["type"] = "number" }
            ),
        };
        var returned = new JsonObject
        {
            ["outputs"] = new JsonObject { ["other"] = 1 },
        };

        OutputPortValidation
            .TryMapAndValidate(returned, ports, out _, out var failure)
            .ShouldBeFalse();
        failure.ShouldNotBeNull();
        failure.ShouldContain("needed");
    }

    [Fact]
    public void bare_return_lands_whole_on_every_port_when_schema_allows()
    {
        var ports = new[]
        {
            new OutputPortSpec(Guid.NewGuid(), "a", new JsonObject { ["type"] = "object" }),
            new OutputPortSpec(Guid.NewGuid(), "b", new JsonObject { ["type"] = "object" }),
        };
        var returned = new JsonObject { ["outVar"] = 4 };

        OutputPortValidation
            .TryMapAndValidate(returned, ports, out var mapped, out var failure)
            .ShouldBeTrue();
        failure.ShouldBeNull();
        var data = OutputPortValidation.BuildSucceededData(new JsonObject(), mapped);
        data["outVar"]!.GetValue<int>().ShouldBe(4);
    }

    [Fact]
    public void schema_mismatch_fails_naming_port()
    {
        var ports = new[]
        {
            new OutputPortSpec(
                Guid.NewGuid(),
                "outVar",
                new JsonObject { ["type"] = "number" }
            ),
        };
        var returned = new JsonObject
        {
            ["outputs"] = new JsonObject { ["outVar"] = "nope" },
        };

        OutputPortValidation
            .TryMapAndValidate(returned, ports, out _, out var failure)
            .ShouldBeFalse();
        failure.ShouldNotBeNull();
        failure.ShouldContain("outVar");
        failure.ShouldContain("schema");
    }

    [Fact]
    public void nullable_port_accepts_null()
    {
        var ports = new[]
        {
            new OutputPortSpec(
                Guid.NewGuid(),
                "maybe",
                new JsonObject { ["type"] = new JsonArray { "number", "null" } }
            ),
        };
        var returned = new JsonObject
        {
            ["outputs"] = new JsonObject { ["maybe"] = null },
        };

        OutputPortValidation
            .TryMapAndValidate(returned, ports, out var mapped, out var failure)
            .ShouldBeTrue();
        failure.ShouldBeNull();
        mapped["outputs"]!.AsObject().ContainsKey("maybe").ShouldBeTrue();
    }
}
