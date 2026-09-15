using Bifrost.WorkItems.Projections;
using Marten;
using Wolverine.Http;

namespace Bifrost.WorkItems.Queries;

public static class ListWorkItemsHandler
{
    public sealed record Query
    {
        public string? Status { get; init; }
    }

    [WolverineQuery("/list-work-items")]
    public static Task<IReadOnlyList<WorkItemIndex.Model>> Handle(
        Query query,
        IQuerySession session
    )
    {
        var items = session.Query<WorkItemIndex.Model>().Where(x => !x.IsDeleted);

        if (query.Status is not null)
        {
            WorkItemStatus status = query.Status;
            items = items.Where(x => x.Status == status.Value);
        }

        return items.ToListAsync();
    }
}
