using Bifrost.Orchestrator.Contracts;
using Wolverine.Attributes;

namespace Bifrost.WorkerNode;

/// <summary>
/// Consumes a durable kill directive for one abandoned attempt. Finds nothing → no-op.
/// Nothing is recorded on delivery or consumption.
/// </summary>
[WolverineIgnore]
public static class KillHarnessProcessesHandler
{
    public static Task Handle(
        KillHarnessProcessesApi.Command command,
        WorkerNodeIdentity identity,
        IHarnessAcceptStore accepts,
        IHarnessRunGate runs
    )
    {
        if (command.WorkerId != identity.Id)
        {
            return Task.CompletedTask;
        }

        // Stop any live process for this attempt only.
        runs.Cancel(command.RunId);

        // Mark the accept concluded so a queued ExecuteHarness for this attempt no-ops.
        var state = accepts.GetState(command.WorkItemId, command.RunId);
        if (state is not null and not HarnessAcceptState.Concluded)
        {
            accepts.MarkConcluded(command.WorkItemId, command.RunId);
        }

        return Task.CompletedTask;
    }
}
