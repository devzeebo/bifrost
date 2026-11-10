using Bifrost.Capabilities.Chat;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Queries;

public static class GetCapabilityChatHandler
{
    [WolverineQuery("/get-capability-chat/{id}")]
    public static Task<GetCapabilityChatApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new GetCapabilityChatApi.Query { Id = id }, session);

    public static async Task<GetCapabilityChatApi.Response> Handle(
        GetCapabilityChatApi.Query query,
        IQuerySession session
    )
    {
        var capability =
            await session.LoadAsync<CapabilityView.Model>(query.Id)
            ?? throw new CommandValidationException($"Capability {query.Id} not found.");

        var chat =
            await session.LoadAsync<CapabilityChatDocument>(query.Id)
            ?? new CapabilityChatDocument { Id = query.Id };

        return await CapabilityChatStore.ToResponseLive(chat, capability, session);
    }
}
