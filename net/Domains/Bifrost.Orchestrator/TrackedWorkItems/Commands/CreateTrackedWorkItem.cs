using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.TrackedWorkItems.Aggregate;
using Bifrost.TrackedWorkItems.Events;
using Bifrost.TrackedWorkItems.Projections;
using Bifrost.TrackedWorkItems.Services;
using Marten;
using Wolverine.Marten;

namespace Bifrost.TrackedWorkItems.Commands;

public static class CreateTrackedWorkItemHandler
{
    public static async Task Validate(
        CreateTrackedWorkItemApi.Command command,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<TrackedWorkItemView.Model>(command.Id) is not null)
        {
            throw new CommandValidationException($"Tracked work item {command.Id} already exists.");
        }

        if (command.Expected is { Count: > 0 })
        {
            throw new CommandValidationException(
                "Tracked work item no longer matches the expected state."
            );
        }
    }

    [WolverinePost("/create-tracked-work-item"), EmptyResponse]
    public static async Task<IStartStream> Handle(
        CreateTrackedWorkItemApi.Command command,
        IBifrostBus bus
    )
    {
        var actor = WorkItemLifecycleActors.ForSystem();
        var status = DefaultWorkItemLifecycle.Definition.InitialStatus;

        await MirrorWorkItemStatusHandler.Handle(
            new MirrorWorkItemStatusHandler.Message
            {
                Id = command.Id,
                Status = status,
                Actor = actor,
                Reason = command.Reason,
                ExpectedStatus = status,
            },
            bus
        );

        return MartenOps.StartStream<TrackedWorkItem>(
            command.Id,
            new TrackedWorkItemCreated
            {
                Id = command.Id,
                Status = status,
                Actor = actor,
                Reason = command.Reason,
            }
        );
    }
}
