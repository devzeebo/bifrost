using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class CompareCapabilityVersionsHandler
{
    [WolverineQuery("/compare-capability-versions/{id}/{leftVersionId}/{rightVersionId}")]
    public static Task<CompareCapabilityVersionsApi.Response> Get(
        Guid id,
        Guid leftVersionId,
        Guid rightVersionId,
        IQuerySession session
    ) =>
        Handle(
            new CompareCapabilityVersionsApi.Query
            {
                Id = id,
                LeftVersionId = leftVersionId,
                RightVersionId = rightVersionId,
            },
            session
        );

    public static async Task<CompareCapabilityVersionsApi.Response> Handle(
        CompareCapabilityVersionsApi.Query query,
        IQuerySession session
    )
    {
        var left = await Load(session, query.Id, query.LeftVersionId);
        var right = await Load(session, query.Id, query.RightVersionId);

        return new CompareCapabilityVersionsApi.Response
        {
            Left = GetCapabilityVersionHandler.ToResponse(left),
            Right = GetCapabilityVersionHandler.ToResponse(right),
        };
    }

    static async Task<CapabilityVersionView.Model> Load(
        IQuerySession session,
        Guid capabilityId,
        Guid versionId
    )
    {
        var version =
            await session.LoadAsync<CapabilityVersionView.Model>(versionId)
            ?? throw new CommandValidationException($"Capability version {versionId} not found.");

        if (version.CapabilityId != capabilityId)
        {
            throw new CommandValidationException($"Capability version {versionId} not found.");
        }

        return version;
    }
}
