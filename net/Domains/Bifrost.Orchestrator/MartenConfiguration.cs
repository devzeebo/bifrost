using Bifrost.Runs.Projections;
using Bifrost.TrackedWorkItems.Projections;
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
        opts.Projections.Add<RunView>(ProjectionLifecycle.Inline);
        opts.Projections.Add<TrackedWorkItemView>(ProjectionLifecycle.Inline);
    }
}

