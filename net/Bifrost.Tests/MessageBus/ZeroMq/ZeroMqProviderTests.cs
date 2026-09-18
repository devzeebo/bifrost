using Bifrost.MessageBus;
using Bifrost.MessageBus.ZeroMq;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Bifrost.Tests.MessageBus.ZeroMq;

public class ZeroMqProviderTests
{
    [Fact]
    public async Task Client_Send_round_trips_through_server_inbound()
    {
        var port = FreeTcpPort();
        var endpoint = $"tcp://127.0.0.1:{port}";

        var serverInbound = new RecordingInbound
        {
            OnHandle = message =>
                Task.FromResult(
                    new BusReply
                    {
                        Payload = BusJson.Serialize(
                            new { echo = BusJson.Deserialize<EchoBody>(message.Payload).Text }
                        ),
                    }
                ),
        };

        using var server = CreateProvider(BusMode.Server, endpoint, serverInbound);
        using var client = CreateProvider(BusMode.Client, endpoint, new RecordingInbound());

        await server.StartAsync(CancellationToken.None);
        await client.StartAsync(CancellationToken.None);
        await Task.Delay(100);

        var reply = await client.Send(
            new BusMessage
            {
                MessageType = "EchoApi",
                Payload = BusJson.Serialize(new EchoBody("hello")),
                CorrelationId = Guid.NewGuid().ToString("N"),
            }
        );

        reply.Error.ShouldBeNull();
        BusJson.Deserialize<EchoResult>(reply.Payload!).Echo.ShouldBe("hello");
        serverInbound.Handled.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Client_Publish_is_delivered_to_server_inbound()
    {
        var port = FreeTcpPort();
        var endpoint = $"tcp://127.0.0.1:{port}";

        var serverInbound = new RecordingInbound();
        using var server = CreateProvider(BusMode.Server, endpoint, serverInbound);
        using var client = CreateProvider(BusMode.Client, endpoint, new RecordingInbound());

        await server.StartAsync(CancellationToken.None);
        await client.StartAsync(CancellationToken.None);
        await Task.Delay(100);

        // First request establishes the client identity on the ROUTER.
        serverInbound.OnHandle = _ => Task.FromResult(new BusReply());
        await client.Send(
            new BusMessage
            {
                MessageType = "PingApi",
                Payload = BusJson.Serialize(new EchoBody("ping")),
                CorrelationId = Guid.NewGuid().ToString("N"),
            }
        );

        await client.Publish(
            new BusMessage
            {
                MessageType = "StatusChangedEvent",
                Payload = BusJson.Serialize(new EchoBody("open")),
            }
        );

        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(2);
        while (serverInbound.Delivered.Count == 0 && DateTime.UtcNow < deadline)
        {
            await Task.Delay(25);
        }

        serverInbound.Delivered.ShouldHaveSingleItem().MessageType.ShouldBe("StatusChangedEvent");
    }

    [Fact]
    public async Task Server_Publish_reaches_client_inbound()
    {
        var port = FreeTcpPort();
        var endpoint = $"tcp://127.0.0.1:{port}";

        var clientInbound = new RecordingInbound();
        var serverInbound = new RecordingInbound
        {
            OnHandle = _ => Task.FromResult(new BusReply()),
        };

        using var server = CreateProvider(BusMode.Server, endpoint, serverInbound);
        using var client = CreateProvider(BusMode.Client, endpoint, clientInbound);

        await server.StartAsync(CancellationToken.None);
        await client.StartAsync(CancellationToken.None);
        await Task.Delay(100);

        // Establish identity so the server can address this dealer.
        await client.Send(
            new BusMessage
            {
                MessageType = "PingApi",
                Payload = BusJson.Serialize(new EchoBody("ping")),
                CorrelationId = Guid.NewGuid().ToString("N"),
            }
        );

        await server.Publish(
            new BusMessage
            {
                MessageType = "StatusChangedEvent",
                Payload = BusJson.Serialize(new EchoBody("fulfilled")),
            }
        );

        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(2);
        while (clientInbound.Delivered.Count == 0 && DateTime.UtcNow < deadline)
        {
            await Task.Delay(25);
        }

        clientInbound.Delivered.ShouldHaveSingleItem().MessageType.ShouldBe("StatusChangedEvent");
    }

    static ZeroMqMessageBusProvider CreateProvider(
        BusMode mode,
        string endpoint,
        IMessageBusInbound inbound
    ) =>
        new(
            new ZeroMqBusOptions { Mode = mode, RouterEndpoint = endpoint },
            inbound,
            NullLogger<ZeroMqMessageBusProvider>.Instance
        );

    static int FreeTcpPort()
    {
        var listener = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, 0);
        listener.Start();
        var port = ((System.Net.IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    sealed record EchoBody(string Text);

    sealed record EchoResult(string Echo);

    sealed class RecordingInbound : IMessageBusInbound
    {
        public List<BusMessage> Handled { get; } = [];
        public List<BusMessage> Delivered { get; } = [];
        public Func<BusMessage, Task<BusReply>>? OnHandle { get; set; }

        public Task<BusReply> Handle(
            BusMessage message,
            CancellationToken cancellationToken = default
        )
        {
            Handled.Add(message);
            return OnHandle?.Invoke(message) ?? Task.FromResult(new BusReply());
        }

        public Task Deliver(BusMessage message, CancellationToken cancellationToken = default)
        {
            Delivered.Add(message);
            return Task.CompletedTask;
        }
    }
}
