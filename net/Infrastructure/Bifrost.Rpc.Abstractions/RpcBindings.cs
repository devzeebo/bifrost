using System.Collections.Concurrent;
using System.Runtime.CompilerServices;

namespace Bifrost.Rpc;

/// <summary>
/// Registry of generated bindings. The source generator emits a module initializer next to each
/// contract that registers its binding here, so <c>AddRpc</c> needs no factory from the caller.
/// </summary>
public static class RpcBindings
{
    public static void Register<TContract>(IRpcBinding<TContract> binding)
        where TContract : class
    {
        ArgumentNullException.ThrowIfNull(binding);
        _bindings[typeof(TContract)] = binding;
    }

    public static IRpcBinding<TContract> Get<TContract>()
        where TContract : class
    {
        if (_bindings.TryGetValue(typeof(TContract), out var binding))
        {
            return (IRpcBinding<TContract>)binding;
        }

        // Registration happens in a module initializer, which has not necessarily run yet if
        // nothing else in the declaring assembly has been touched.
        RuntimeHelpers.RunModuleConstructor(typeof(TContract).Module.ModuleHandle);

        if (_bindings.TryGetValue(typeof(TContract), out binding))
        {
            return (IRpcBinding<TContract>)binding;
        }

        throw new InvalidOperationException(
            $"No generated RPC binding for '{typeof(TContract)}'. The assembly declaring the contract "
                + "must reference Bifrost.Rpc.Abstractions (or Bifrost.Rpc) so the source generator runs."
        );
    }

    static readonly ConcurrentDictionary<Type, object> _bindings = new();
}
