using Bifrost.Workflows.Aggregate;
using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Events;
using Bifrost.Workflows.Projections;
using Bifrost.Workflows.ValueObjects;
using Marten;
using Wolverine.Marten;

namespace Bifrost.Workflows.Commands;

public static class CreateWorkflowHandler
{
    public static async Task Validate(CreateWorkflowApi.Command command, IQuerySession session)
    {
        if (await session.LoadAsync<WorkflowView.Model>(command.Id) is not null)
        {
            throw new CommandValidationException($"Workflow {command.Id} already exists.");
        }

        WorkflowGraphValidation.Validate(command.Name, command.Nodes, command.Connections);
    }

    [WolverinePost("/create-workflow"), EmptyResponse]
    public static IStartStream Handle(CreateWorkflowApi.Command command)
    {
        var graph = WorkflowGraphValidation.Validate(
            command.Name,
            command.Nodes,
            command.Connections
        );
        return MartenOps.StartStream<Workflow>(
            command.Id,
            new WorkflowCreated
            {
                Id = command.Id,
                Name = command.Name.Trim(),
                Nodes = graph.Nodes,
                Connections = graph.Connections,
            }
        );
    }
}
