using Bifrost.Capabilities.Events;
using Marten.Events.Aggregation;

namespace Bifrost.Capabilities.Projections;

public class CapabilityIndex : SingleStreamProjection<CapabilityIndex.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required string Name { get; init; }
        public bool HasPublishedSkill { get; init; }
    }

    public Model Create(CapabilityCreated e) =>
        new()
        {
            Id = e.Id,
            Name = e.Name,
            HasPublishedSkill = false,
        };

    public Model Apply(CapabilityRenamed e, Model view) => view with { Name = e.Name };
}
