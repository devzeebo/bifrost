using Bifrost.Capabilities.Events;
using Marten.Events.Aggregation;

namespace Bifrost.Capabilities.Projections;

public class CapabilityView : SingleStreamProjection<CapabilityView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required string Name { get; init; }
        public required string Ask { get; init; }
    }

    public Model Create(CapabilityCreated e) =>
        new()
        {
            Id = e.Id,
            Name = e.Name,
            Ask = e.Ask,
        };

    public Model Apply(CapabilityAskChanged e, Model view) => view with { Ask = e.Ask };

    public Model Apply(CapabilityRenamed e, Model view) => view with { Name = e.Name };
}
