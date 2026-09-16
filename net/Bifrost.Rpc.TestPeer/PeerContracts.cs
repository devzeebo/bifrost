namespace Bifrost.Rpc.TestPeer;

/// <summary>
/// Declared here rather than in the test project so the launched process and the test that
/// launches it share one contract assembly.
/// </summary>
public interface IPeerEcho : IRpcContract
{
    Task<PeerEchoResult> Echo(string payload, CancellationToken cancellationToken = default);
}

public sealed record PeerEchoResult(string Value, string InstanceId, string Payload);
