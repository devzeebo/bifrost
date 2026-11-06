using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class CompareSkillVersionsHandler
{
    [WolverineQuery("/compare-skill-versions/{id}/{leftVersionId}/{rightVersionId}")]
    public static Task<CompareSkillVersionsApi.Response> Get(
        Guid id,
        Guid leftVersionId,
        Guid rightVersionId,
        IQuerySession session
    ) =>
        Handle(
            new CompareSkillVersionsApi.Query
            {
                Id = id,
                LeftVersionId = leftVersionId,
                RightVersionId = rightVersionId,
            },
            session
        );

    public static async Task<CompareSkillVersionsApi.Response> Handle(
        CompareSkillVersionsApi.Query query,
        IQuerySession session
    )
    {
        var left = await Load(session, query.Id, query.LeftVersionId);
        var right = await Load(session, query.Id, query.RightVersionId);

        return new CompareSkillVersionsApi.Response
        {
            Left = GetSkillVersionHandler.ToResponse(left),
            Right = GetSkillVersionHandler.ToResponse(right),
        };
    }

    static async Task<SkillVersionView.Model> Load(
        IQuerySession session,
        Guid capabilityId,
        Guid versionId
    )
    {
        var version =
            await session.LoadAsync<SkillVersionView.Model>(versionId)
            ?? throw new CommandValidationException($"Skill version {versionId} not found.");

        if (version.CapabilityId != capabilityId)
        {
            throw new CommandValidationException($"Skill version {versionId} not found.");
        }

        return version;
    }
}
