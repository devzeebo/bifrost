using Bifrost.Workflows.Aggregate;
using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Events;
using Marten;

namespace Bifrost.Workflows.Commands;

public static class DeleteWorkflowHandler
{
    [WolverinePost("/delete-workflow"), EmptyResponse]
    public static async Task Handle(DeleteWorkflowApi.Command command, IDocumentSession session)
    {
        var stream = await session.Events.FetchForWriting<Workflow>(command.Id);
        if (stream.Aggregate is null || stream.Aggregate.IsDeleted)
        {
            throw new NotFoundException($"Workflow {command.Id} not found.");
        }

        stream.AppendOne(new WorkflowDeleted());
    }
}
