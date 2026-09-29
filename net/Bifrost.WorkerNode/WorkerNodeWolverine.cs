using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using JasperFx;
using JasperFx.CodeGeneration;
using Wolverine;
using Wolverine.Runtime.Heartbeat;
using Wolverine.Sqlite;

namespace Bifrost.WorkerNode;

public static class WorkerNodeWolverine
{
    public static void Configure(WolverineOptions opts, string outboxPath, Guid nodeId)
    {
        var directory = Path.GetDirectoryName(outboxPath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        opts.ApplicationAssembly = typeof(WorkerNodeWolverine).Assembly;
        opts.CodeGeneration.TypeLoadMode = TypeLoadMode.Static;
        opts.CodeGeneration.GeneratedCodeOutputPath = Path.GetFullPath(
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "Internal", "Generated")
        );
        opts.ServiceName = nodeId.ToString();

        opts.PersistMessagesWithSqlite($"Data Source={outboxPath}")
            .OverrideAutoCreateResources(AutoCreate.CreateOrUpdate);

        opts.Policies.UseDurableLocalQueues();
        opts.Policies.UseDurableOutboxOnAllSendingEndpoints();
        opts.Policies.AlwaysMakeScheduledMessagesDurable();

        opts.Discovery.IncludeAssembly(typeof(WorkerNodeWolverine).Assembly);

        opts.EnableHeartbeats(TimeSpan.FromSeconds(1));
        opts.UseBifrostBus();
        opts.PublishMessage<WorkerNodeRegistered.Command>().To(BifrostBusEndpoint.Address);
        opts.PublishMessage<WolverineHeartbeat>().To(BifrostBusEndpoint.Address);
    }
}
