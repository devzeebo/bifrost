namespace Bifrost.Rpc;

/// <summary>
/// Wire method names reserved by the transport. Contracts must not claim these.
/// </summary>
public static class RpcMethods
{
    /// <summary>Peer to host, on connect: <c>{ instanceId, role }</c>.</summary>
    public const string Ready = "bifrost.ready";

    /// <summary>Host to peer notification asking it to exit.</summary>
    public const string Shutdown = "bifrost.shutdown";

    /// <summary>Liveness probe answered by both sides with <c>{ ok: true }</c>.</summary>
    public const string Ping = "bifrost.ping";
}
