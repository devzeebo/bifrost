using Bifrost.Capabilities.Projections;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class ListCapabilitiesHandler
{
    [WolverineQuery("/list-capabilities")]
    public static async Task<ListCapabilitiesApi.Response> Handle(
        ListCapabilitiesApi.Query query,
        IQuerySession session
    )
    {
        var list = await session.Query<CapabilityIndex.Model>().ToListAsync();
        return new ListCapabilitiesApi.Response
        {
            Items =
            [
                .. list.Select(x => new ListCapabilitiesApi.Response.Item
                {
                    Id = x.Id,
                    Name = x.Name,
                    HasPublishedSkill = x.HasPublishedSkill,
                }),
            ],
        };
    }
}
