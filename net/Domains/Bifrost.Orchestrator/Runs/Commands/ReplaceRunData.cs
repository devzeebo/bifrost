using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Aggregate;
using Bifrost.Runs.Events;
using Wolverine.Marten;

namespace Bifrost.Runs.Commands;

public static class ReplaceRunDataHandler
{
    public static void Validate(ReplaceRunDataApi.Command command, Run run) =>
        run.EnsureExpected(command.Expected);

    [WolverinePost("/replace-run-data"), EmptyResponse]
    [AggregateHandler]
    public static RunDataReplaced Handle(ReplaceRunDataApi.Command command, Run run) =>
        new()
        {
            Data = command.Data,
            Actor = command.Actor,
            Reason = command.Reason,
        };
}
