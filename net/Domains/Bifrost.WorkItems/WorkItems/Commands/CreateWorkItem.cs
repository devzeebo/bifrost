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

        if (command.Expected is { Count: > 0 })
        {
            throw new CommandValidationException("Work item no longer matches the expected state.");
        }
    }

    [WolverinePost("/create-work-item"), EmptyResponse]
    public static IStartStream Handle(CreateWorkItemApi.Command command) =>
        MartenOps.StartStream<WorkItem>(
            command.Id,
            new WorkItemCreated
            {
                Id = command.Id,
                Data = command.Data,
                Status = command.Status,
                Actor = command.Actor,
                Reason = command.Reason,
            }
        );
}
