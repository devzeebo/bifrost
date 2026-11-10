using Bifrost.Workflows.Projections;
using JasperFx.Events.Projections;
using Marten;

namespace Bifrost;

public static class MartenConfiguration
{
    public static void Configure(StoreOptions opts)
    {
        opts.DatabaseSchemaName = "workflows";

        opts.Projections.Add<WorkflowView>(ProjectionLifecycle.Inline);
        opts.Projections.Add<WorkflowIndex>(ProjectionLifecycle.Inline);

        opts.Schema.For<WorkflowIndex.Model>().Identity(x => x.Id);
    }
}
