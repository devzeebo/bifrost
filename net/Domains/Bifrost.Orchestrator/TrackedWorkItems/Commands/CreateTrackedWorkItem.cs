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
    public static Task Validate(
        CreateTrackedWorkItemApi.Command command,
        IQuerySession _session
    )
    {
        if (command.Expected is { Count: > 0 })
        {
            throw new CommandValidationException(
                "Create tracked work item does not accept an expected state."
            );
        }

        return Task.CompletedTask;
    }

    [WolverinePost("/create-tracked-work-item"), EmptyResponse]
    public static async Task<IStartStream?> Handle(
        CreateTrackedWorkItemApi.Command command,
        IBifrostBus bus,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<TrackedWorkItemView.Model>(command.Id) is not null)
        {
            return null;
        }

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
                RequestKey = MirrorRequestKeys.ForCreate(command.Id, status),
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
