using Bifrost.Capabilities.Projections;
using JasperFx.Events.Projections;
using Marten;

namespace Bifrost;

public static class MartenConfiguration
{
    public static void Configure(StoreOptions opts)
    {
        opts.DatabaseSchemaName = "skills";

        opts.Projections.Add<CapabilityView>(ProjectionLifecycle.Inline);
        opts.Projections.Add<CapabilityIndex>(ProjectionLifecycle.Inline);

        opts.Schema.For<CapabilityIndex.Model>().Identity(x => x.Id);
    }
}
