using System.Text.Json.Nodes;
using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Bifrost.WorkItems.Projections;
using Marten;
using Wolverine.Http;
using Wolverine.Marten;

namespace Bifrost.WorkItems.Commands;

public static class CreateWorkItemHandler
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
        public required WorkItemStatus Status { get; init; }
    }

    public static async Task Validate(Command command, IQuerySession session)
    {
        if (await session.LoadAsync<WorkItemView.Model>(command.Id) is not null)
        {
            throw new CommandValidationException($"Work item {command.Id} already exists.");
        }
    }

    [WolverinePost("/create-work-item"), EmptyResponse]
    public static IStartStream Handle(Command command) =>
        MartenOps.StartStream<WorkItem>(
            command.Id,
            new WorkItemCreated
            {
                Id = command.Id,
                Data = command.Data,
                Status = command.Status,
            }
        );
}
