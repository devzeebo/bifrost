using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class ListSkillVersionsHandler
{
    [WolverineQuery("/list-skill-versions/{id}")]
    public static Task<ListSkillVersionsApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new ListSkillVersionsApi.Query { Id = id }, session);

    public static async Task<ListSkillVersionsApi.Response> Handle(
        ListSkillVersionsApi.Query query,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<CapabilityView.Model>(query.Id) is null)
        {
            throw new CommandValidationException($"Capability {query.Id} not found.");
        }

        var items = await session
            .Query<SkillVersionView.Model>()
            .Where(x => x.CapabilityId == query.Id)
            .OrderByDescending(x => x.RecordedAt)
            .ToListAsync();

        return new ListSkillVersionsApi.Response
        {
            Items =
            [
                .. items.Select(x => new ListSkillVersionsApi.VersionSummary
                {
                    VersionId = x.Id,
                    RecordedAt = x.RecordedAt,
                    DerivedAgainstCapabilityVersionId = x.Snapshot.DerivedAgainstCapabilityVersionId,
                    DerivedAgainstSuiteRunId = x.Snapshot.DerivedAgainstSuiteRunId,
                }),
            ],
        };
    }
}
