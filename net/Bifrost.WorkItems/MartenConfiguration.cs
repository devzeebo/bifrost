using Bifrost.RelationshipTypes.Projections;
using Bifrost.WorkItems.Projections;
using JasperFx.Events.Projections;
using Marten;

namespace Bifrost;

public static class MartenConfiguration
{
    public static void Configure(StoreOptions opts)
    {
        opts.Projections.Add<RelationshipTypeView>(ProjectionLifecycle.Inline);
        opts.Projections.Add<RelationshipTypeByWord>(ProjectionLifecycle.Inline);
        opts.Projections.Add<WorkItemView>(ProjectionLifecycle.Inline);
        opts.Projections.Add<WorkItemIndex>(ProjectionLifecycle.Inline);

        opts.Schema.For<RelationshipTypeByWord.Model>().Identity(x => x.Id);
        opts.Schema.For<WorkItemIndex.Model>().Identity(x => x.Id);
        opts.Schema.For<WorkItemIndex.Model>().Index(x => x.Status);
    }
}
