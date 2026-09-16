namespace Bifrost.Rpc.Tests.Contracts;

public interface IEcho : IRpcContract
{
    Task<EchoResult> Echo(string payload, CancellationToken cancellationToken = default);
}

public sealed record EchoResult(string Value, string Payload);

public interface IHostPing : IRpcContract
{
    Task<HostPong> Ping(string from, CancellationToken cancellationToken = default);
}

public sealed record HostPong(string Message);

public interface ILifecycle : IRpcContract
{
    Task NotifyReady(string instanceId);

    Task<Unit> Flush(CancellationToken cancellationToken = default);
}
