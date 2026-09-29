using Bifrost.WorkerNodes.Projections;
using JasperFx.Events.Projections;
using Marten;

namespace Bifrost;

public static class MartenConfiguration
{
    public static void Configure(StoreOptions opts)
    {
        opts.DatabaseSchemaName = "orchestrator";
        opts.Projections.Add<WorkerNodeView>(ProjectionLifecycle.Inline);
    }
}
