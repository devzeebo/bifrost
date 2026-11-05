using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class GetCapabilityHandler
{
    [WolverineQuery("/get-capability/{id}")]
    public static Task<GetCapabilityApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new GetCapabilityApi.Query { Id = id }, session);

    public static async Task<GetCapabilityApi.Response> Handle(
        GetCapabilityApi.Query query,
        IQuerySession session
    )
    {
        var item =
            await session.LoadAsync<CapabilityView.Model>(query.Id)
            ?? throw new CommandValidationException($"Capability {query.Id} not found.");

        var index = await session.LoadAsync<CapabilityIndex.Model>(query.Id);

        return new GetCapabilityApi.Response
        {
            Id = item.Id,
            Name = item.Name,
            Ask = item.Ask,
            Criteria = [],
            Evals = [],
            HasPublishedSkill = index?.HasPublishedSkill ?? false,
        };
    }
}
