using Bifrost.Rpc.Tests.Contracts;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;

namespace Bifrost.Rpc.Tests;

public class RpcContractTests
{
    [Fact]
    public async Task IRpc_broadcasts_to_every_instance_and_returns_the_primary_result()
    {
        var primaryEcho = new EchoService("A");
        var shadowEcho = new EchoService("B");

        await using var graph = new RpcTestGraph()
            .ConfigureHost(["primary", "shadow"], services => services.AddRpc<IEcho>())
            .AddPeer("primary", "primary", Serve<IEcho>(primaryEcho))
            .AddPeer("shadow", "shadow", Serve<IEcho>(shadowEcho));

        await graph.Start();

        var echo = graph.HostServices.GetRequiredService<IRpc<IEcho>>().Object;
        var result = await echo.Echo("hi");

        result.Value.ShouldBe("A");
        result.Payload.ShouldBe("hi");

        // The shadow was called too, its answer was just discarded.
        await Waiting.Until(() => shadowEcho.Payloads.Count == 1);
        shadowEcho.Payloads.ShouldBe(["hi"]);
    }

    [Fact]
    public async Task Enumerable_of_IRpc_yields_one_handle_per_connected_instance()
    {
        await using var graph = new RpcTestGraph()
            .ConfigureHost(["primary", "shadow"], services => services.AddRpc<IEcho>())
            .AddPeer("primary", "primary", Serve<IEcho>(new EchoService("A")))
            .AddPeer("shadow", "shadow", Serve<IEcho>(new EchoService("B")));

        await graph.Start();

        var handles = graph.HostServices.GetRequiredService<IEnumerable<IRpc<IEcho>>>().ToArray();
        handles.Length.ShouldBe(2);

        var values = new List<string>();
        foreach (var handle in handles)
        {
            values.Add((await handle.Object.Echo("x")).Value);
        }

        values.ShouldBe(["A", "B"], ignoreOrder: true);
    }

    [Fact]
    public async Task Handler_serves_inbound_calls_and_replies_to_the_calling_instance_only()
    {
        var ping = new HostPingService();

        await using var graph = new RpcTestGraph()
            .ConfigureHost(
                ["primary", "shadow"],
                services =>
                {
                    services.AddSingleton<IHostPing>(ping);
                    services.AddRpcHandler<IHostPing>();
                    services.AddRpc<IEcho>();
                }
            )
            .AddPeer(
                "primary",
                "primary",
                services =>
                {
                    services.AddSingleton<IEcho>(new EchoService("A"));
                    services.AddRpcHandler<IEcho>();
                    services.AddRpc<IHostPing>();
                }
            )
            .AddPeer(
                "shadow",
                "shadow",
                services =>
                {
                    services.AddSingleton<IEcho>(new EchoService("B"));
                    services.AddRpcHandler<IEcho>();
                    services.AddRpc<IHostPing>();
                }
            );

        await graph.Start();

        var fromShadow = await graph
            .Peer("shadow")
            .GetRequiredService<IRpc<IHostPing>>()
            .Object.Ping("shadow");
        var fromPrimary = await graph
            .Peer("primary")
            .GetRequiredService<IRpc<IHostPing>>()
            .Object.Ping("primary");

        fromShadow.Message.ShouldBe("pong:shadow");
        fromPrimary.Message.ShouldBe("pong:primary");
        ping.Callers.ShouldBe(["shadow", "primary"]);

        // Same sessions still carry host-initiated calls in the other direction.
        var echoed = await graph.HostServices.GetRequiredService<IRpc<IEcho>>().Object.Echo("hi");
        echoed.Value.ShouldBe("A");
    }

    [Fact]
    public async Task Task_is_a_notification_and_Task_of_Unit_awaits_completion()
    {
        var lifecycle = new LifecycleService();

        await using var graph = new RpcTestGraph()
            .ConfigureHost(["primary"], services => services.AddRpc<ILifecycle>())
            .AddPeer("primary", "primary", Serve<ILifecycle>(lifecycle));

        await graph.Start();

        var proxy = graph.HostServices.GetRequiredService<IRpc<ILifecycle>>().Object;

        // Fire-and-forget: the await completes as soon as the frame is written.
        await proxy.NotifyReady("primary");
        await Waiting.Until(() => lifecycle.ReadyFrom is not null);
        lifecycle.ReadyFrom.ShouldBe("primary");

        // Awaitable with no payload: the await does not complete until the peer is done.
        await proxy.Flush();
        lifecycle.Flushed.ShouldBeTrue();
    }

    static Action<IServiceCollection> Serve<TContract>(TContract implementation)
        where TContract : class, IRpcContract =>
        services =>
        {
            services.AddSingleton(implementation);
            services.AddRpcHandler<TContract>();
        };

    sealed class EchoService(string value) : IEcho
    {
        public IReadOnlyList<string> Payloads
        {
            get
            {
                lock (_payloads)
                {
                    return [.. _payloads];
                }
            }
        }

        public Task<EchoResult> Echo(string payload, CancellationToken cancellationToken = default)
        {
            lock (_payloads)
            {
                _payloads.Add(payload);
            }

            return Task.FromResult(new EchoResult(value, payload));
        }

        readonly List<string> _payloads = [];
    }

    sealed class HostPingService : IHostPing
    {
        public IReadOnlyList<string> Callers
        {
            get
            {
                lock (_callers)
                {
                    return [.. _callers];
                }
            }
        }

        public Task<HostPong> Ping(string from, CancellationToken cancellationToken = default)
        {
            lock (_callers)
            {
                _callers.Add(from);
            }

            return Task.FromResult(new HostPong($"pong:{from}"));
        }

        readonly List<string> _callers = [];
    }

    sealed class LifecycleService : ILifecycle
    {
        public string? ReadyFrom { get; private set; }

        public bool Flushed { get; private set; }

        public Task NotifyReady(string instanceId)
        {
            ReadyFrom = instanceId;
            return Task.CompletedTask;
        }

        public async Task<Unit> Flush(CancellationToken cancellationToken = default)
        {
            await Task.Delay(30, cancellationToken);
            Flushed = true;
            return Unit.Value;
        }
    }
}
