using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Projections;
using Marten;

namespace Bifrost.Runs.Queries;

public static class GetRunHandler
{
    [WolverineQuery("/get-run/{id}")]
    public static Task<GetRunApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new GetRunApi.Query { Id = id }, session);

    public static async Task<GetRunApi.Response> Handle(
        GetRunApi.Query query,
        IQuerySession session
    )
    {
        var run =
            await session.LoadAsync<RunView.Model>(query.Id)
            ?? throw new CommandValidationException($"Run {query.Id} not found.");

        return new GetRunApi.Response
        {
            Id = run.Id,
            WorkItemId = run.WorkItemId,
            Outcome = run.Outcome,
            Data = run.Data,
            Metadata = run.Metadata,
        };
    }
}
