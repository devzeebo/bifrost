using Bifrost.Workflows.Contracts;
using Bifrost.Workflows.Projections;
using Marten;

namespace Bifrost.Workflows.Queries;

public static class GetWorkflowHandler
{
    [WolverineQuery("/get-workflow/{id}")]
    public static Task<GetWorkflowApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new GetWorkflowApi.Query { Id = id }, session);

    public static async Task<GetWorkflowApi.Response> Handle(
        GetWorkflowApi.Query query,
        IQuerySession session
    )
    {
        var workflow =
            await session.LoadAsync<WorkflowView.Model>(query.Id)
            ?? throw new NotFoundException($"Workflow {query.Id} not found.");

        var state =
            await session.Events.FetchStreamStateAsync(query.Id)
            ?? throw new NotFoundException($"Workflow {query.Id} not found.");

        return new GetWorkflowApi.Response
        {
            Id = workflow.Id,
            Name = workflow.Name,
            Version = state.Version,
            Nodes = workflow.Nodes,
            Connections = workflow.Connections,
        };
    }
}
