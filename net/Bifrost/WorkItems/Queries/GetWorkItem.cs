using Bifrost.WorkItems.Projections;
using Wolverine.Http;
using Wolverine.Http.Marten;

namespace Bifrost.WorkItems.Queries;

public static class GetWorkItemHandler
{
    [WolverineQuery("/get-work-item/{id}")]
    public static WorkItemView.Model Handle([Document] WorkItemView.Model item) => item;
}
