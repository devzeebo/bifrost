using System.Text.Json.Nodes;
using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Wolverine.Marten;

namespace Bifrost.WorkItems.Commands;

public static class ReplaceWorkItemDataHandler
{
    public static void Validate(ReplaceWorkItemDataApi.Command command, WorkItem workItem)
    {
        if (workItem.IsDeleted)
        {
            throw new CommandValidationException("Work item is deleted.");
        }
    }

    [AggregateHandler]
    public static WorkItemDataReplaced Handle(
        ReplaceWorkItemDataApi.Command command,
        WorkItem workItem
    ) => new() { Data = command.Data };
}
