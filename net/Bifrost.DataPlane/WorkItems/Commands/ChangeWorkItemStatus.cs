using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Wolverine.Marten;

namespace Bifrost.WorkItems.Commands;

public static class ChangeWorkItemStatusHandler
{
    public static void Validate(ChangeWorkItemStatusApi.Command command, WorkItem workItem)
    {
        if (workItem.IsDeleted)
        {
            throw new CommandValidationException("Work item is deleted.");
        }
    }

    [AggregateHandler]
    public static WorkItemStatusChanged Handle(
        ChangeWorkItemStatusApi.Command command,
        WorkItem workItem
    ) => new() { Status = command.Status };
}
