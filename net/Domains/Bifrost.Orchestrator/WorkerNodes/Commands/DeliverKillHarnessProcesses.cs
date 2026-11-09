using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;

namespace Bifrost.WorkerNodes.Commands;

public static class DeliverKillHarnessProcessesHandler
{
    public static async Task Handle(
        DeliverKillHarnessProcesses message,
        IBifrostBus bus,
        CancellationToken cancellationToken
    )
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(AckWait);

        try
        {
            await bus.Request<KillHarnessProcessesApi.Command, Unit>(
                    new KillHarnessProcessesApi.Command
                    {
                        WorkerId = message.WorkerId,
                        WorkItemId = message.WorkItemId,
                        RunId = message.RunId,
                    },
                    timeout.Token
                )
                .ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Worker did not ack in time. The kill already sits on the node command queue
            // (published before the wait) and will be consumed when the worker returns —
            // do not fail this handler or block the bus session waiting for a dead peer.
        }
    }

    /// <summary>
    /// How long to wait for a worker ack. The command is published to the node queue
    /// before this wait; timing out leaves it there for the worker to consume on return
    /// without holding the bus session open indefinitely.
    /// </summary>
    static readonly TimeSpan AckWait = TimeSpan.FromSeconds(2);
}
