using System.Text.Json.Nodes;
using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Wolverine.Http;
using Wolverine.Marten;

namespace Bifrost.WorkItems.Commands;

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

    [WolverinePost("/replace-work-item-data"), EmptyResponse]
    [AggregateHandler]
    public static WorkItemDataReplaced Handle(Command command, WorkItem workItem) =>
        new() { Data = command.Data };
}
