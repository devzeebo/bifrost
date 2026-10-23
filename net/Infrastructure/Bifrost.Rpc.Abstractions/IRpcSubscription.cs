using Microsoft.Extensions.DependencyInjection;

namespace Bifrost.Rpc;

/// <summary>
/// A set of inbound handlers to attach to each session. Registered by <c>AddRpcHandler</c> and
/// applied by the endpoint's hosted service.
/// </summary>
public interface IRpcSubscription
{
    void Apply(RpcSession session);
}

internal sealed class RpcSubscription<TContract> : IRpcSubscription
    where TContract : class
{
    public void Apply(RpcSession session) =>
        RpcBindings.Get<TContract>().Subscribe(session, _services.GetRequiredService<TContract>());

    readonly IServiceProvider _services;

    public RpcSubscription(IServiceProvider services)
    {
        _services = services;
    }
}
