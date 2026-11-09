using Wolverine;

namespace Bifrost.WorkerNode;

public interface IHarnessJobScheduler
{
    Task Enqueue(ExecuteHarness job, CancellationToken cancellationToken = default);
}

public sealed class WolverineHarnessJobScheduler(IMessageBus bus) : IHarnessJobScheduler
{
    public Task Enqueue(ExecuteHarness job, CancellationToken cancellationToken = default) =>
        bus.PublishAsync(job).AsTask();
}
