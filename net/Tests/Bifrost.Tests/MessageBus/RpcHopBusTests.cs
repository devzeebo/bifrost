using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Bifrost.MessageBus;
using Bifrost.Tests;

namespace Bifrost.Tests.MessageBus;

public class RpcHopBusTests
{
    [Fact]
    public async Task Request_round_trips_plane_to_provider_over_rpc()
    {
        // Shared router stands in for the far-side plane: the provider delivers into it
        // without calling back over the same RPC session (which would deadlock the read loop).
        var farSide = new MessageBusRouter();
        farSide.RegisterHandler(
            "EchoApi",
            (message, _) =>
            {
                var command = BusJson.Deserialize<EchoApi.Command>(message.Payload);
                return Task.FromResult(
                    new BusReply
                    {
                        Payload = BusJson.Serialize(
                            new EchoApi.Response { Value = $"echo:{command.Payload}" }
                        ),
                    }
                );
            }
        );

        await using var graph = new MessageBusTestGraph()
            .ConfigurePlane()
            .ConfigureProvider<BridgeProvider>(services =>
                services.AddSingleton(farSide).AddSingleton<BridgeProvider>()
            );

        await graph.Start();

        var bus = graph.PlaneServices.GetRequiredService<IBifrostBus>();
        var response = await bus.Request<EchoApi.Command, EchoApi.Response>(
            new EchoApi.Command { Payload = "hi" }
        );

        response.Value.ShouldBe("echo:hi");
    }

    [Fact]
    public async Task BusError_from_far_side_surfaces_as_BusException()
    {
        var farSide = new MessageBusRouter();
        farSide.RegisterHandler(
            "EchoApi",
            (_, _) =>
                Task.FromResult(
                    new BusReply
                    {
                        Error = new BusError
                        {
                            Code = BusErrorCodes.Validation,
                            Message = "nope",
                        },
                    }
                )
        );

        await using var graph = new MessageBusTestGraph()
            .ConfigurePlane()
            .ConfigureProvider<BridgeProvider>(services =>
                services.AddSingleton(farSide).AddSingleton<BridgeProvider>()
            );

        await graph.Start();

        var bus = graph.PlaneServices.GetRequiredService<IBifrostBus>();
        var ex = await Should.ThrowAsync<BusException>(() =>
            bus.Request<EchoApi.Command, EchoApi.Response>(new EchoApi.Command { Payload = "x" })
        );

        ex.Error.Code.ShouldBe(BusErrorCodes.Validation);
        ex.Error.Message.ShouldBe("nope");
    }

    [Fact]
    public async Task Publish_reaches_far_side_subscriber_through_provider()
    {
        var received = new List<string>();
        var farSide = new MessageBusRouter();
        farSide.RegisterSubscriber(
            "StatusChangedEvent",
            (message, _) =>
            {
                received.Add(BusJson.Deserialize<StatusChangedEvent>(message.Payload).Status);
                return Task.CompletedTask;
            }
        );

        await using var graph = new MessageBusTestGraph()
            .ConfigurePlane()
            .ConfigureProvider<BridgeProvider>(services =>
                services.AddSingleton(farSide).AddSingleton<BridgeProvider>()
            );

        await graph.Start();

        var bus = graph.PlaneServices.GetRequiredService<IBifrostBus>();
        await bus.Publish(new StatusChangedEvent { Status = "fulfilled" });

        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(2);
        while (received.Count == 0 && DateTime.UtcNow < deadline)
        {
            await Task.Delay(25);
        }

        received.ShouldBe(["fulfilled"]);
    }

    [Fact]
    public async Task Provider_pushes_inbound_Handle_into_the_plane()
    {
        await using var graph = new MessageBusTestGraph()
            .ConfigurePlane(services =>
            {
                services.AddMessageBusHandler<EchoApi.Command, EchoApi.Response>(
                    (_, command, _) =>
                        Task.FromResult(new EchoApi.Response { Value = $"echo:{command.Payload}" })
                );
            })
            .ConfigureProvider<NoopProvider>();

        await graph.Start();

        // Peer initiates toward the plane (not from inside a handler), so no read-loop deadlock.
        var inbound = graph.ProviderServices.GetRequiredService<IMessageBusInbound>();
        var reply = await inbound.Handle(
            new BusMessage
            {
                MessageType = "EchoApi",
                Payload = BusJson.Serialize(new EchoApi.Command { Payload = "yo" }),
            }
        );

        reply.Error.ShouldBeNull();
        BusJson.Deserialize<EchoApi.Response>(reply.Payload!).Value.ShouldBe("echo:yo");
    }
}

/// <summary>
/// Provider that delivers into a far-side <see cref="MessageBusRouter"/> — the stand-in for a
/// second plane behind a real broker hop.
/// </summary>
sealed class BridgeProvider(MessageBusRouter farSide) : IMessageBusProvider
{
    public Task<BusReply> Send(BusMessage message, CancellationToken cancellationToken = default) =>
        farSide.Handle(message, cancellationToken);

    public Task Publish(BusMessage message, CancellationToken cancellationToken = default) =>
        farSide.Deliver(message, cancellationToken);

    public Task Subscribe(string topic, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}

sealed class NoopProvider : IMessageBusProvider
{
    public Task<BusReply> Send(BusMessage message, CancellationToken cancellationToken = default) =>
        Task.FromResult(
            new BusReply
            {
                Error = new BusError
                {
                    Code = BusErrorCodes.Internal,
                    Message = "NoopProvider does not send.",
                },
            }
        );

    public Task Publish(BusMessage message, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task Subscribe(string topic, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
