namespace Bifrost.Rpc;

/// <summary>
/// Handle to a generated proxy for <typeparamref name="TContract"/>.
/// Resolve <c>IRpc&lt;T&gt;</c> to call the group (fan-out with the primary's response) or
/// <c>IEnumerable&lt;IRpc&lt;T&gt;&gt;</c> to address connected instances individually.
/// </summary>
public interface IRpc<out TContract>
    where TContract : class
{
    TContract Object { get; }
}

internal sealed class RpcHandle<TContract> : IRpc<TContract>
    where TContract : class
{
    public TContract Object { get; }

    public RpcHandle(TContract proxy)
    {
        Object = proxy ?? throw new ArgumentNullException(nameof(proxy));
    }
}
