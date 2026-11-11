using Bifrost.Workflows.Aggregate;
using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Events;
using Bifrost.Workflows.ValueObjects;
using Wolverine.Marten;

namespace Bifrost.Workflows.Commands;

public static class SaveWorkflowHandler
{
    public static void Validate(SaveWorkflowApi.Command command, Workflow workflow) =>
        WorkflowGraphValidation.Validate(command.Name, command.Nodes, command.Connections);

    [WolverinePost("/save-workflow"), EmptyResponse]
    [AggregateHandler]
    public static WorkflowSaved Handle(SaveWorkflowApi.Command command, Workflow workflow)
    {
        var graph = WorkflowGraphValidation.Validate(
            command.Name,
            command.Nodes,
            command.Connections
        );
        return new WorkflowSaved
        {
            Name = command.Name.Trim(),
            Nodes = graph.Nodes,
            Connections = graph.Connections,
        };
    }
}
