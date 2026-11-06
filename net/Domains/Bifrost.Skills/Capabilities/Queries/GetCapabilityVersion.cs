using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class GetCapabilityVersionHandler
{
    [WolverineQuery("/get-capability-version/{id}/{versionId}")]
    public static Task<GetCapabilityVersionApi.Response> Get(
        Guid id,
        Guid versionId,
        IQuerySession session
    ) =>
        Handle(
            new GetCapabilityVersionApi.Query { Id = id, VersionId = versionId },
            session
        );

    public static async Task<GetCapabilityVersionApi.Response> Handle(
        GetCapabilityVersionApi.Query query,
        IQuerySession session
    )
    {
        var version =
            await session.LoadAsync<CapabilityVersionView.Model>(query.VersionId)
            ?? throw new CommandValidationException(
                $"Capability version {query.VersionId} not found."
            );

        if (version.CapabilityId != query.Id)
        {
            throw new CommandValidationException(
                $"Capability version {query.VersionId} not found."
            );
        }

        return ToResponse(version);
    }

    internal static GetCapabilityVersionApi.Response ToResponse(CapabilityVersionView.Model version) =>
        new()
        {
            VersionId = version.Id,
            CapabilityId = version.CapabilityId,
            RecordedAt = version.RecordedAt,
            Snapshot = version.Snapshot,
        };
}
