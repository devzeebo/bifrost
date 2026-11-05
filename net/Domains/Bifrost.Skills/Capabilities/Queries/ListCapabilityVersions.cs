using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class ListCapabilityVersionsHandler
{
    [WolverineQuery("/list-capability-versions/{id}")]
    public static Task<ListCapabilityVersionsApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new ListCapabilityVersionsApi.Query { Id = id }, session);

    public static async Task<ListCapabilityVersionsApi.Response> Handle(
        ListCapabilityVersionsApi.Query query,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<CapabilityView.Model>(query.Id) is null)
        {
            throw new CommandValidationException($"Capability {query.Id} not found.");
        }

        var items = await session
            .Query<CapabilityVersionView.Model>()
            .Where(x => x.CapabilityId == query.Id)
            .OrderByDescending(x => x.RecordedAt)
            .ToListAsync();

        return new ListCapabilityVersionsApi.Response
        {
            Items =
            [
                .. items.Select(x => new ListCapabilityVersionsApi.VersionSummary
                {
                    VersionId = x.Id,
                    RecordedAt = x.RecordedAt,
                }),
            ],
        };
    }
}
