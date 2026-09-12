using Bifrost.Domain.RelationshipTypes.Projections;
using Bifrost.Domain.WorkItems.Projections;
using JasperFx.Events.Projections;
using Marten;

namespace Bifrost.Domain;

public static class MartenConfiguration
{
    public static void Configure(StoreOptions opts)
    {
        opts.Projections.Add<RelationshipTypeView>(ProjectionLifecycle.Inline);
        opts.Projections.Add<WorkItemView>(ProjectionLifecycle.Inline);
        opts.Projections.Add<WorkItemIndex>(ProjectionLifecycle.Inline);

        opts.Schema.For<RelationshipTypeByWord>().Identity(x => x.Word);
        opts.Schema.For<WorkItemIndex.Model>().Identity(x => x.Id);
    }
}
