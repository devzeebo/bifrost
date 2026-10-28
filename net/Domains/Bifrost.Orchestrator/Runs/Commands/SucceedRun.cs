using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Aggregate;
using Bifrost.Runs.Events;
using Wolverine.Marten;

namespace Bifrost.Runs.Commands;

public static class SucceedRunHandler
{
    public static void Validate(SucceedRunApi.Command command, Run run) =>
        run.EnsureCanEnd(command.Expected);

    [WolverinePost("/succeed-run"), EmptyResponse]
    [AggregateHandler]
    public static RunSucceeded Handle(SucceedRunApi.Command command, Run run) =>
        new() { Actor = command.Actor, Reason = command.Reason };
}
