using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Wolverine.Http;
using Wolverine.Marten;

namespace Bifrost.WorkItems.Commands;

public static class ChangeWorkItemStatusHandler
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required WorkItemStatus Status { get; init; }
    }

    public static void Validate(Command command, WorkItem workItem)
    {
        if (workItem.IsDeleted)
        {
            throw new CommandValidationException("Work item is deleted.");
        }
    }

    [WolverinePost("/change-work-item-status"), EmptyResponse]
    [AggregateHandler]
    public static WorkItemStatusChanged Handle(Command command, WorkItem workItem) =>
        new() { Status = command.Status };
}
