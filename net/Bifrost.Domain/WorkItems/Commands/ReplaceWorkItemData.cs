using System.Text.Json.Nodes;
using Bifrost.Domain.WorkItems.Aggregate;
using Bifrost.Domain.WorkItems.Events;
using Wolverine.Marten;

namespace Bifrost.Domain.WorkItems.Commands;

public static class ReplaceWorkItemDataHandler
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
    }

    public static void Validate(Command command, WorkItem workItem)
    {
        if (workItem.IsDeleted)
        {
            throw new CommandValidationException("Work item is deleted.");
        }
    }

    [AggregateHandler]
    public static WorkItemDataReplaced Handle(Command command, WorkItem workItem) =>
        new() { Data = command.Data };
}
