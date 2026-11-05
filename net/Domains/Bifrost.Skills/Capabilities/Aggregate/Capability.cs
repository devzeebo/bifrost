using Bifrost.Capabilities.Events;

namespace Bifrost.Capabilities.Aggregate;

public class Capability
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Ask { get; set; }

    public void Apply(CapabilityCreated e)
    {
        Id = e.Id;
        Name = e.Name;
        Ask = e.Ask;
    }

    public void Apply(CapabilityAskChanged e)
    {
        Ask = e.Ask;
    }

    public void Apply(CapabilityRenamed e)
    {
        Name = e.Name;
    }
}
