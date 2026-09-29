using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.WorkerNode;
using JasperFx.Resources;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Wolverine;
using Wolverine.Runtime.Heartbeat;

namespace Bifrost.Tests.WorkerNode;

public class WorkerNodeTests
{
    [Fact]
    public async Task registration_is_sent_once_then_a_heartbeat_follows()
    {
        var nodeId = Guid.NewGuid();
        var bus = new RecordingBus();
        var outboxPath = Path.Combine(Path.GetTempPath(), $"bifrost-worker-{nodeId:N}.db");

        var builder = Host.CreateApplicationBuilder();
        builder.Services.AddSingleton<IBifrostBus>(bus);
        builder.Services.AddSingleton(new WorkerNodeIdentity { Id = nodeId });
        builder.Services.AddResourceSetupOnStartup();
        builder.UseWolverine(opts => WorkerNodeWolverine.Configure(opts, outboxPath, nodeId));
        builder.Services.AddHostedService<WorkerRegistrationService>();

        using var host = builder.Build();
        await host.StartAsync();
        try
        {
            var deadline = DateTime.UtcNow.AddSeconds(10);
            while (DateTime.UtcNow < deadline && !bus.Published.OfType<WolverineHeartbeat>().Any())
            {
                await Task.Delay(50);
            }

            bus.Published.OfType<WorkerNodeRegistered.Command>().ShouldHaveSingleItem().Id.ShouldBe(nodeId);
            bus.Published.OfType<WolverineHeartbeat>().ShouldContain(x => x.ServiceName == nodeId.ToString());
        }
        finally
        {
            await host.StopAsync();
            if (File.Exists(outboxPath))
            {
                File.Delete(outboxPath);
            }
        }
    }

    sealed class RecordingBus : IBifrostBus
    {
        public List<object> Published { get; } = [];

        public Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
        {
            lock (Published)
            {
                Published.Add(@event!);
            }

            return Task.CompletedTask;
        }

        public Task<TResponse> Request<TRequest, TResponse>(
            TRequest request,
            CancellationToken cancellationToken = default
        ) => throw new NotSupportedException();
    }
}
