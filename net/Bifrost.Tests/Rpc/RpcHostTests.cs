using Bifrost.Rpc.TestPeer;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;

namespace Bifrost.Tests.Rpc;

public class RpcHostTests
{
    [Fact]
    public async Task Start_times_out_when_instances_never_connect()
    {
        await using var host = new RpcHost(
            new RpcHostOptions
            {
                SocketPath = NewSocketPath(),
                ReadyTimeout = TimeSpan.FromMilliseconds(200),
                LaunchProcesses = false,
                Instances =
                {
                    new RpcInstanceOptions { Id = "primary", Role = RpcRole.Primary },
                },
            }
        );

        var ex = await Should.ThrowAsync<TimeoutException>(() => host.Start());
        ex.Message.ShouldContain("did not become ready");
    }

    [Fact]
    public async Task Start_returns_immediately_when_WaitForReadyOnStart_is_false()
    {
        await using var host = new RpcHost(
            new RpcHostOptions
            {
                SocketPath = NewSocketPath(),
                LaunchProcesses = false,
                WaitForReadyOnStart = false,
                Instances =
                {
                    new RpcInstanceOptions { Id = "primary", Role = RpcRole.Primary },
                },
            }
        );

        await host.Start();

        host.IsRunning.ShouldBeTrue();
        File.Exists(host.SocketPath).ShouldBeTrue();
        host.Instances.Single().Connected.ShouldBeFalse();
    }

    [Fact]
    public async Task GroupSession_reports_primary_unavailable_before_anyone_connects()
    {
        await using var host = new RpcHost(
            new RpcHostOptions { SocketPath = NewSocketPath(), LaunchProcesses = false }
        );

        var ex = await Should.ThrowAsync<JsonRpcException>(() =>
            host.GroupSession.Invoke<string>("IEcho.Echo")
        );
        ex.Code.ShouldBe(JsonRpcErrorCodes.PrimaryUnavailable);
    }

    [Fact]
    public async Task Instances_reports_connection_state_and_Stop_removes_the_socket()
    {
        await using var graph = new RpcTestGraph()
            .ConfigureHost(["primary", "shadow"])
            .AddPeer("primary", "primary", _ => { })
            .AddPeer("shadow", "shadow", _ => { });

        await graph.Start();

        var host = graph.HostServices.GetRequiredService<IRpcHost>();
        host.IsRunning.ShouldBeTrue();
        host.Instances.ShouldAllBe(i => i.Connected);
        host.Instances.Single(i => i.Role == RpcRole.Primary).Id.ShouldBe("primary");
        File.Exists(graph.SocketPath).ShouldBeTrue();

        await host.Stop();

        File.Exists(graph.SocketPath).ShouldBeFalse();
    }

    [Fact]
    public async Task Host_launches_peer_processes_and_calls_them_through_IRpc()
    {
        var socketPath = NewSocketPath();
        var peerDll = FindTestPeerDll();

        var services = new ServiceCollection();
        services.AddRpcHost(options =>
        {
            options.SocketPath = socketPath;
            options.ReadyTimeout = TimeSpan.FromSeconds(30);
            options.Instances =
            [
                Instance("primary", RpcRole.Primary, peerDll, "from-process-primary"),
                Instance("shadow", RpcRole.Shadow, peerDll, "from-process-shadow"),
            ];
        });
        services.AddRpc<IPeerEcho>();

        await using var provider = services.BuildServiceProvider();
        var host = provider.GetRequiredService<IRpcHost>();

        await host.Start();
        host.Instances.ShouldAllBe(i => i.Connected);

        var result = await provider.GetRequiredService<IRpc<IPeerEcho>>().Object.Echo("hi");

        result.Value.ShouldBe("from-process-primary");
        result.InstanceId.ShouldBe("primary");
        result.Payload.ShouldBe("hi");

        await host.Stop();
        File.Exists(socketPath).ShouldBeFalse();
    }

    static RpcInstanceOptions Instance(string id, RpcRole role, string peerDll, string echoValue) =>
        new()
        {
            Id = id,
            Role = role,
            Executable = "dotnet",
            Arguments = [peerDll],
            Environment = { ["TESTPEER_ECHO"] = echoValue },
        };

    static string NewSocketPath() =>
        Path.Combine(Path.GetTempPath(), $"bifrost-rpc-host-{Guid.NewGuid():N}.sock");

    static string FindTestPeerDll()
    {
        string[] configurations = ["Debug", "Release"];
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            foreach (var configuration in configurations)
            {
                var candidate = Path.Combine(
                    dir.FullName,
                    "Bifrost.Rpc.TestPeer",
                    "bin",
                    configuration,
                    "net10.0",
                    "Bifrost.Rpc.TestPeer.dll"
                );
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            dir = dir.Parent;
        }

        throw new FileNotFoundException(
            "Could not locate Bifrost.Rpc.TestPeer.dll. Build the TestPeer project first."
        );
    }
}
