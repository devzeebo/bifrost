namespace Bifrost.Rpc;

/// <summary>
/// Overrides the JSON-RPC method name on the wire.
/// Default is <c>{InterfaceName}.{MethodName}</c> with a trailing <c>Async</c> stripped.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
#pragma warning disable CS9113 // Parameter is unread.
public sealed class RpcMethodAttribute(string name) : Attribute;
#pragma warning restore CS9113 // Parameter is unread.
