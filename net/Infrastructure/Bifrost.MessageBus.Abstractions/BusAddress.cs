namespace Bifrost.MessageBus;

/// <summary>
/// Container that handles this request. Nested <c>Command</c> and <c>Query</c> types use the
/// address on their declaring API class.
/// </summary>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class BusAddressAttribute : Attribute
{
    public string Container { get; }

    public BusAddressAttribute(string container)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(container);
        Container = container;
    }
}

/// <summary>
/// Optional pin to one node of <see cref="BusAddressAttribute.Container"/>.
/// An empty <see cref="Node"/> stays on the shared container queue.
/// </summary>
public interface INodeAffinity
{
    string? Node { get; }
}
