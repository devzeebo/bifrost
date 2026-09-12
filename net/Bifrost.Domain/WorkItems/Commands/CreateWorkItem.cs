using System.Text.Json.Nodes;
using Bifrost.Domain.WorkItems.Aggregate;
using Bifrost.Domain.WorkItems.Events;
using Bifrost.Domain.WorkItems.Projections;
using Marten;
using Wolverine.Marten;

namespace Bifrost.Domain.WorkItems.Commands;

public static class CreateWorkItemHandler
{
    public sealed record Command
    {
        public required Guid Id { get; init; }
        public required JsonNode Data { get; init; }
    }

    public static async Task Validate(Command command, IQuerySession session)
    {
        if (await session.LoadAsync<WorkItemView.Model>(command.Id) is not null)
        {
            throw new CommandValidationException($"Work item {command.Id} already exists.");
        }
    }

    public static IStartStream Handle(Command command) =>
        MartenOps.StartStream<WorkItem>(
            command.Id,
            new WorkItemCreated { Id = command.Id, Data = command.Data }
        );
}
