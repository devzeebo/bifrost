using Bifrost.Orchestrator.Contracts;
using Bifrost.Runs.Aggregate;
using Bifrost.Runs.Events;
using Wolverine.Marten;

namespace Bifrost.Runs.Commands;

public static class AbandonRunHandler
{
    public static void Validate(AbandonRunApi.Command command, Run run) =>
        run.EnsureCanEnd(command.Expected);

    [WolverinePost("/abandon-run"), EmptyResponse]
    [AggregateHandler]
    public static RunAbandoned Handle(AbandonRunApi.Command command, Run run) =>
        new() { Actor = command.Actor, Reason = command.Reason };
}
