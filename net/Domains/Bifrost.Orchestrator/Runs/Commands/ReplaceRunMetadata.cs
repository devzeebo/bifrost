using System.Text.Json.Nodes;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Aggregate;
using Bifrost.Runs.Events;
using Wolverine.Marten;

namespace Bifrost.Runs.Commands;

public static class ReplaceRunMetadataHandler
{
    public static void Validate(ReplaceRunMetadataApi.Command command, Run run) =>
        run.EnsureExpected(command.Expected);

    [WolverinePost("/replace-run-metadata"), EmptyResponse]
    [AggregateHandler]
    public static RunMetadataReplaced Handle(ReplaceRunMetadataApi.Command command, Run run) =>
        new()
        {
            Metadata = (JsonObject)command.Metadata.DeepClone()!,
            Actor = command.Actor,
            Reason = command.Reason,
        };
}
