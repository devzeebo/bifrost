using Bifrost.Orchestrator.Contracts;

namespace Bifrost.Gateway;

public interface IVirtualKeyQuotaClient
{
    Task<GetVirtualKeyQuotaApi.Response> GetQuota(CancellationToken ct = default);
}
