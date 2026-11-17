using System.Text.Json.Nodes;
using Bifrost.WorkerNode;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class OutputPortValidationTests
{
    [Fact]
    public void explicit_outputs_map_by_id_and_validate_schema()
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
        mapped["outputs"]![portId.ToString("D")]!.GetValue<int>().ShouldBe(4);

        var data = OutputPortValidation.BuildSucceededData(
            new JsonObject { ["node"] = new JsonObject() },
            mapped
        );
        data["outputs"]![portId.ToString("D")]!.GetValue<int>().ShouldBe(4);
    }

    [Fact]
    public void duplicate_port_names_keep_distinct_id_keys()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var ports = new[]
        {
            new OutputPortSpec(first, "result", new JsonObject { ["type"] = "number" }),
            new OutputPortSpec(second, "result", new JsonObject { ["type"] = "number" }),
        };
        var returned = new JsonObject
        {
            ["outputs"] = new JsonObject
            {
                [first.ToString("D")] = 1,
                [second.ToString("D")] = 2,
            },
        };

        OutputPortValidation
            .TryMapAndValidate(returned, ports, out var mapped, out var failure)
            .ShouldBeTrue();
        failure.ShouldBeNull();
        mapped["outputs"]![first.ToString("D")]!.GetValue<int>().ShouldBe(1);
        mapped["outputs"]![second.ToString("D")]!.GetValue<int>().ShouldBe(2);
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
    public void bare_null_becomes_explicit_null_outputs()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var ports = new[]
        {
            new OutputPortSpec(
                first,
                "a",
                new JsonObject { ["type"] = new JsonArray { "number", "null" } }
            ),
            new OutputPortSpec(
                second,
                "b",
                new JsonObject { ["type"] = new JsonArray { "number", "null" } }
            ),
        };

        OutputPortValidation
            .TryMapAndValidate(null, ports, out var mapped, out var failure)
            .ShouldBeTrue();
        failure.ShouldBeNull();

        var data = OutputPortValidation.BuildSucceededData(
            new JsonObject { ["node"] = new JsonObject() },
            mapped
        );
        data["outputs"]!.AsObject().ContainsKey(first.ToString("D")).ShouldBeTrue();
        data["outputs"]![first.ToString("D")].ShouldBeNull();
        data["outputs"]![second.ToString("D")].ShouldBeNull();
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
        var portId = Guid.NewGuid();
        var ports = new[]
        {
            new OutputPortSpec(
                portId,
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
        mapped["outputs"]!.AsObject().ContainsKey(portId.ToString("D")).ShouldBeTrue();
    }

    [Fact]
    public void no_declared_ports_ignores_return()
    {
        var returned = new JsonObject
        {
            ["inputs"] = new JsonObject { ["x"] = 1 },
            ["outputs"] = new JsonObject { ["outVar"] = 4 },
        };

        OutputPortValidation
            .TryMapAndValidate(returned, [], out var mapped, out var failure)
            .ShouldBeTrue();
        failure.ShouldBeNull();
        mapped.Count.ShouldBe(0);

        var issued = new JsonObject
        {
            ["node"] = new JsonObject(),
            ["inputs"] = new JsonObject { ["x"] = 1 },
        };
        var data = OutputPortValidation.BuildSucceededData(issued, mapped);
        data.ToJsonString().ShouldBe(issued.ToJsonString());
    }
}
