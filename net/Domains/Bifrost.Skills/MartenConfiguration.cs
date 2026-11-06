using Bifrost.Capabilities.Chat;
using Bifrost.Capabilities.Projections;
using JasperFx.Events.Projections;
using Marten;
using Marten.Schema;

namespace Bifrost;

public static class MartenConfiguration
{
    public static void Configure(StoreOptions opts)
    {
        opts.DatabaseSchemaName = "skills";

        opts.Projections.Add<CapabilityView>(ProjectionLifecycle.Inline);
        opts.Projections.Add<CapabilityIndex>(ProjectionLifecycle.Inline);
        opts.Projections.Add<CapabilityVersionView>(ProjectionLifecycle.Inline);
        opts.Projections.Add<SkillVersionView>(ProjectionLifecycle.Inline);

        opts.Schema.For<CapabilityIndex.Model>()
            .Identity(x => x.Id)
            .UniqueIndex(UniqueIndexType.DuplicatedField, x => x.Name);
        opts.Schema.For<CapabilityVersionView.Model>().Identity(x => x.Id);
        opts.Schema.For<SkillVersionView.Model>().Identity(x => x.Id);
        opts.Schema.For<CapabilityChatDocument>().Identity(x => x.Id);
    }
}
