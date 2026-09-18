using Bifrost.WorkItems.Aggregate;
using Bifrost.WorkItems.Events;
using Bifrost.WorkItems.Projections;
using Marten;
using Wolverine.Marten;

namespace Bifrost.WorkItems.Commands;

public static class CreateWorkItemHandler
{
    public static async Task Validate(CreateWorkItemApi.Command command, IQuerySession session)
    {
        if (await session.LoadAsync<WorkItemView.Model>(command.Id) is not null)
        {
            throw new CommandValidationException($"Work item {command.Id} already exists.");
        }
    }

    public static IStartStream Handle(CreateWorkItemApi.Command command) =>
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
