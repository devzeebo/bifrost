using Bifrost.WorkerNodes.Projections;
using Marten;

namespace Bifrost.WorkerNodes.Queries;

public static class ListWorkerNodesHandler
{
    public sealed record Query;

    [WolverineQuery("/list-worker-nodes")]
    public static Task<IReadOnlyList<WorkerNodeView.Model>> Handle(Query _, IQuerySession session) =>
        session.Query<WorkerNodeView.Model>().ToListAsync();
}
