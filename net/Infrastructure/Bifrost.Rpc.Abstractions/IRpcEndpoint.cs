namespace Bifrost.Rpc;

/// <summary>
/// The session surface shared by <c>RpcHost</c> (listens, one session per instance) and
/// <c>RpcPeer</c> (connects, a single session).
/// </summary>
public interface IRpcEndpoint
{
    /// <summary>
    /// Stable session for outbound calls. Requests fan out to every connected instance and the
    /// primary's response is returned; membership is resolved per call, so the session object
    /// stays valid across reconnects.
    /// </summary>
    RpcSession GroupSession { get; }

    /// <summary>Currently connected sessions, one per instance.</summary>
    IReadOnlyList<RpcSession> Sessions { get; }

    /// <summary>
    /// Registers inbound handlers. <paramref name="subscribe"/> runs against every already
    /// connected session and against each new one before it starts reading.
    /// </summary>
    void AddSubscriber(Action<RpcSession> subscribe);
}
