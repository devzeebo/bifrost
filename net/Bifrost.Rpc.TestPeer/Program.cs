using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Bifrost.Rpc.TestPeer;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        var options = RpcPeerOptions.FromEnvironment(args);
        var echoValue = Environment.GetEnvironmentVariable("TESTPEER_ECHO") ?? options.InstanceId;

        var builder = Host.CreateApplicationBuilder(args);
        builder.Services.AddRpcPeer(_ => options);
        builder.Services.AddSingleton<IPeerEcho>(new PeerEcho(echoValue, options.InstanceId));
        builder.Services.AddRpcHandler<IPeerEcho>();

        await builder.Build().RunAsync();
        return 0;
    }
}

internal sealed class PeerEcho(string value, string instanceId) : IPeerEcho
{
    public Task<PeerEchoResult> Echo(
        string payload,
        CancellationToken cancellationToken = default
    ) => Task.FromResult(new PeerEchoResult(value, instanceId, payload));
}
