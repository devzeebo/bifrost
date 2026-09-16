namespace Bifrost.Rpc;

/// <summary>
/// Generated glue between a contract and the wire. One binding is emitted per
/// <see cref="IRpcContract"/> interface and registered in <see cref="RpcBindings"/>.
/// </summary>
public interface IRpcBinding<TContract>
    where TContract : class
{
    /// <summary>Wraps <paramref name="session"/> in a proxy that turns calls into JSON-RPC.</summary>
    TContract CreateProxy(RpcSession session);

    /// <summary>Maps every contract method on <paramref name="session"/> onto <paramref name="implementation"/>.</summary>
    void Subscribe(RpcSession session, TContract implementation);
}
