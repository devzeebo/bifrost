using Bifrost.WorkItems.Projections;
using Marten;
using Wolverine.Http;

namespace Bifrost.WorkItems.Queries;

public static class ListWorkItemsHandler
{
    public sealed record Query;

    [WolverineQuery("/list-work-items")]
    public static Task<IReadOnlyList<WorkItemIndex.Model>> Handle(
        Query _,
        IQuerySession session
    ) => session.Query<WorkItemIndex.Model>().Where(x => !x.IsDeleted).ToListAsync();
}
