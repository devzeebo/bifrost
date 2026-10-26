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

        workItem.EnsureExpected(command.Expected);
    }

    [WolverinePost("/replace-work-item-data"), EmptyResponse]
    [AggregateHandler]
    public static WorkItemDataReplaced Handle(
        ReplaceWorkItemDataApi.Command command,
        WorkItem workItem
    ) =>
        new()
        {
            Data = command.Data,
            Actor = command.Actor,
            Reason = command.Reason,
        };
}
