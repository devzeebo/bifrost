using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Aggregate;
using Bifrost.Runs.Events;
using Wolverine.Marten;

namespace Bifrost.Runs.Commands;

public static class FailRunHandler
{
    public static void Validate(FailRunApi.Command command, Run run) =>
        run.EnsureCanEnd(command.Expected);

    [WolverinePost("/fail-run"), EmptyResponse]
    [AggregateHandler]
    public static RunFailed Handle(FailRunApi.Command command, Run run) =>
        new() { Actor = command.Actor, Reason = command.Reason };
}
