using Microsoft.Extensions.Hosting;
using Wolverine;

namespace Bifrost.WorkerNode;

public sealed class WorkerRegistrationService(IMessageBus bus, WorkerNodeIdentity identity)
    : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        bus.InvokeAsync(new RegisterWorker { NodeId = identity.Id }, stoppingToken);
}

public sealed record WorkerNodeIdentity
{
    public required Guid Id { get; init; }
}
