using System.Text.Json.Nodes;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Aggregate;
using Bifrost.Runs.Events;
using Bifrost.Runs.Projections;
using Marten;
using Wolverine.Marten;

namespace Bifrost.Runs.Commands;

public static class CreateRunHandler
{
    public static async Task Validate(CreateRunApi.Command command, IQuerySession session)
    {
        if (await session.LoadAsync<RunView.Model>(command.Id) is not null)
        {
            throw new CommandValidationException($"Run {command.Id} already exists.");
        }

        if (command.Expected is { Count: > 0 })
        {
            throw new CommandValidationException("Run no longer matches the expected state.");
        }
    }

    [WolverinePost("/create-run"), EmptyResponse]
    public static IStartStream Handle(CreateRunApi.Command command) =>
        MartenOps.StartStream<Run>(
            command.Id,
            new RunCreated
            {
                Id = command.Id,
                WorkItemId = command.WorkItemId,
                Data = command.Data?.DeepClone() ?? new JsonObject(),
                Metadata = command.Metadata is null
                    ? new JsonObject()
                    : (JsonObject)command.Metadata.DeepClone()!,
                Actor = command.Actor,
                Reason = command.Reason,
            }
        );
}
