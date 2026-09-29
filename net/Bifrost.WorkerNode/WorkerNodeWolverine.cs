using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using JasperFx;
using Wolverine;
using Wolverine.Sqlite;

namespace Bifrost.WorkerNode;

public static class WorkerNodeWolverine
{
    public static void Configure(WolverineOptions opts, string outboxPath)
    {
        var directory = Path.GetDirectoryName(outboxPath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        opts.PersistMessagesWithSqlite($"Data Source={outboxPath}")
            .OverrideAutoCreateResources(AutoCreate.CreateOrUpdate);

        opts.Policies.UseDurableLocalQueues();
        opts.Policies.UseDurableOutboxOnAllSendingEndpoints();
        opts.Policies.AlwaysMakeScheduledMessagesDurable();

        opts.Discovery.IncludeAssembly(typeof(WorkerNodeWolverine).Assembly);

        opts.UseBifrostBus();
        opts.PublishMessage<WorkerNodeRegistered.Event>().To(BifrostBusEndpoint.Address);
        opts.PublishMessage<WorkerNodeHeartbeat.Event>().To(BifrostBusEndpoint.Address);
    }
}
