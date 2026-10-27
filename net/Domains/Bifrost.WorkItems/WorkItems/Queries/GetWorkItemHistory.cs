using Bifrost.WorkItems.Events;
using Marten;

namespace Bifrost.WorkItems.Queries;

public static class GetWorkItemHistoryHandler
{
    [WolverineQuery("/get-work-item-history/{id}")]
    public static Task<GetWorkItemHistoryApi.Response> Get(Guid id, IQuerySession session) =>
        Handle(new GetWorkItemHistoryApi.Query { Id = id }, session);

    public static async Task<GetWorkItemHistoryApi.Response> Handle(
        GetWorkItemHistoryApi.Query query,
        IQuerySession session
    )
    {
        var events = await session.Events.FetchStreamAsync(query.Id);
        if (events.Count == 0)
        {
            throw new CommandValidationException($"Work item {query.Id} not found.");
        }

        return new GetWorkItemHistoryApi.Response
        {
            Changes =
            [
                .. events.Select(e =>
                    e.Data switch
                    {
                        WorkItemCreated created => Change(
                            e,
                            nameof(WorkItemCreated),
                            created.Actor,
                            created.Reason,
                            created.Status
                        ),
                        WorkItemStatusChanged statusChanged => Change(
                            e,
                            nameof(WorkItemStatusChanged),
                            statusChanged.Actor,
                            statusChanged.Reason,
                            statusChanged.Status
                        ),
                        WorkItemDataReplaced dataReplaced => Change(
                            e,
                            nameof(WorkItemDataReplaced),
                            dataReplaced.Actor,
                            dataReplaced.Reason
                        ),
                        WorkItemMetadataReplaced metadataReplaced => Change(
                            e,
                            nameof(WorkItemMetadataReplaced),
                            metadataReplaced.Actor,
                            metadataReplaced.Reason
                        ),
                        RelationshipAdded relationshipAdded => Change(
                            e,
                            nameof(RelationshipAdded),
                            relationshipAdded.Actor,
                            relationshipAdded.Reason
                        ),
                        RelationshipRemoved relationshipRemoved => Change(
                            e,
                            nameof(RelationshipRemoved),
                            relationshipRemoved.Actor,
                            relationshipRemoved.Reason
                        ),
                        WorkItemDeleted deleted => Change(
                            e,
                            nameof(WorkItemDeleted),
                            deleted.Actor,
                            deleted.Reason
                        ),
                        _ => throw new CommandValidationException(
                            $"Unrecognized work item change {e.Data.GetType().Name}."
                        ),
                    }
                ),
            ],
        };
    }

    static GetWorkItemHistoryApi.Response.Change Change(
        JasperFx.Events.IEvent e,
        string type,
        string actor,
        string reason,
        WorkItemStatus? status = null
    ) =>
        new()
        {
            Type = type,
            Actor = actor,
            Reason = reason,
            At = e.Timestamp,
            Status = status?.Value,
        };
}
