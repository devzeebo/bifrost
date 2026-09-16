namespace Bifrost.Rpc;

/// <summary>
/// Marker for interfaces that participate in Bifrost RPC codegen.
/// Methods must return <c>Task</c>/<c>ValueTask</c> (notification) or
/// <c>Task&lt;T&gt;</c>/<c>ValueTask&lt;T&gt;</c> (request; use <see cref="Unit"/> when there is no payload).
/// Optional trailing <see cref="CancellationToken"/> is supported.
/// </summary>
public interface IRpcContract;
