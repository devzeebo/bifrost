using System.Text.Json.Nodes;
using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Wolverine.Marten;

namespace Bifrost.WorkItems.Commands;

public static class ReplaceWorkItemMetadataHandler
{
    public static void Validate(ReplaceWorkItemMetadataApi.Command command, WorkItem workItem)
    {
        if (workItem.IsDeleted)
        {
            throw new CommandValidationException("Work item is deleted.");
        }

        workItem.EnsureExpected(command.Expected);
    }

    [WolverinePost("/replace-work-item-metadata"), EmptyResponse]
    [AggregateHandler]
    public static WorkItemMetadataReplaced Handle(
        ReplaceWorkItemMetadataApi.Command command,
        WorkItem workItem
    ) =>
        new()
        {
            Metadata = (JsonObject)command.Metadata.DeepClone()!,
            Actor = command.Actor,
            Reason = command.Reason,
        };
}
