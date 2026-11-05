using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class GetSkillVersionHandler
{
    [WolverineQuery("/get-skill-version/{id}/{versionId}")]
    public static Task<GetSkillVersionApi.Response> Get(
        Guid id,
        Guid versionId,
        IQuerySession session
    ) => Handle(new GetSkillVersionApi.Query { Id = id, VersionId = versionId }, session);

    public static async Task<GetSkillVersionApi.Response> Handle(
        GetSkillVersionApi.Query query,
        IQuerySession session
    )
    {
        var version =
            await session.LoadAsync<SkillVersionView.Model>(query.VersionId)
            ?? throw new CommandValidationException($"Skill version {query.VersionId} not found.");

        if (version.CapabilityId != query.Id)
        {
            throw new CommandValidationException($"Skill version {query.VersionId} not found.");
        }

        return ToResponse(version);
    }

    internal static GetSkillVersionApi.Response ToResponse(SkillVersionView.Model version) =>
        new()
        {
            VersionId = version.Id,
            CapabilityId = version.CapabilityId,
            RecordedAt = version.RecordedAt,
            Snapshot = version.Snapshot,
        };
}
