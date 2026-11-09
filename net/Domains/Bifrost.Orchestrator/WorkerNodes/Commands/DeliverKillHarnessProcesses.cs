using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;

namespace Bifrost.WorkerNodes.Commands;

public static class DeliverKillHarnessProcessesHandler
{
    public static Task Handle(DeliverKillHarnessProcesses message, IBifrostBus bus) =>
        bus.Request<KillHarnessProcessesApi.Command, Unit>(
            new KillHarnessProcessesApi.Command
            {
                WorkerId = message.WorkerId,
                WorkItemId = message.WorkItemId,
                RunId = message.RunId,
            }
        );
}
