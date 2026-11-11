using Bifrost.Workflows.Aggregate;
using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Events;
using Bifrost.Workflows.ValueObjects;
using Marten;

namespace Bifrost.Workflows.Commands;

public static class SaveWorkflowHandler
{
    [WolverinePost("/save-workflow"), EmptyResponse]
    public static async Task Handle(SaveWorkflowApi.Command command, IDocumentSession session)
    {
        var graph = WorkflowGraphValidation.Validate(
            command.Name,
            command.Nodes,
            command.Connections
        );

        var stream = await session.Events.FetchForWriting<Workflow>(command.Id);
        if (stream.Aggregate is null || stream.Aggregate.IsDeleted)
        {
            throw new NotFoundException($"Workflow {command.Id} not found.");
        }

        if (!command.Overwrite && stream.CurrentVersion != command.ExpectedVersion)
        {
            throw new ConcurrencyConflictException(
                "Workflow changed since it was opened."
            );
        }

        stream.AppendOne(
            new WorkflowSaved
            {
                Name = command.Name.Trim(),
                Nodes = graph.Nodes,
                Connections = graph.Connections,
            }
        );
    }
}
