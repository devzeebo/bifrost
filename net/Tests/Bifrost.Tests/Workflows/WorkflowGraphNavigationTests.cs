extern alias Workflows;

using System.Text.Json.Nodes;
using Bifrost.Workflows.Contracts;
using Shouldly;
using WorkflowGraphNavigation = Workflows::Bifrost.Workflows.Execution.WorkflowGraphNavigation;

namespace Bifrost.Tests.Workflows;

public class WorkflowGraphNavigationTests
{
    [Fact]
    public void record_produced_outputs_keeps_present_null_values()
    {
        var portId = Guid.NewGuid();
        var node = new WorkflowNode
        {
            Id = Guid.NewGuid(),
            Name = "n1",
            Position = new NodePosition { X = 0, Y = 0 },
            Inputs = [],
            Outputs =
            [
                new WorkflowPort
                {
                    Id = portId,
                    Name = "result",
                    Schema = new JsonObject { ["type"] = new JsonArray { "number", "null" } },
                },
            ],
        };

        var recorded = WorkflowGraphNavigation.RecordProducedOutputs(
            node,
            new JsonObject { ["outputs"] = new JsonObject { ["result"] = null } }
        );

        recorded.ContainsKey(portId.ToString("D")).ShouldBeTrue();
        recorded[portId.ToString("D")].ShouldBeNull();
    }

    [Fact]
    public void record_produced_outputs_reads_guid_keys()
    {
        var portId = Guid.NewGuid();
        var node = new WorkflowNode
        {
            Id = Guid.NewGuid(),
            Name = "n1",
            Position = new NodePosition { X = 0, Y = 0 },
            Inputs = [],
            Outputs =
            [
                new WorkflowPort
                {
                    Id = portId,
                    Name = "result",
                    Schema = new JsonObject { ["type"] = "number" },
                },
            ],
        };

        var recorded = WorkflowGraphNavigation.RecordProducedOutputs(
            node,
            new JsonObject { ["outputs"] = new JsonObject { [portId.ToString("D")] = 7 } }
        );

        recorded[portId.ToString("D")]!.GetValue<int>().ShouldBe(7);
    }
}
