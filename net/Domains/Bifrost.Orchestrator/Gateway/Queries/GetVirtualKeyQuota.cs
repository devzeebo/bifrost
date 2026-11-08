using Bifrost.Gateway;
using Bifrost.Orchestrator.Contracts;

namespace Bifrost.Gateway.Queries;

public static class GetVirtualKeyQuotaHandler
{
    public sealed record Query;

    [WolverineQuery("/get-virtual-key-quota")]
    public static Task<GetVirtualKeyQuotaApi.Response> Handle(
        Query _,
        IVirtualKeyQuotaClient client,
        CancellationToken ct
    ) => client.GetQuota(ct);
}
