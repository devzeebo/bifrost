using Bifrost.MessageBus;
using Bifrost.MessageBus.ZeroMq;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;

namespace Bifrost.Tests.MessageBus.ZeroMq;

public class ZeroMqProviderTests
{
    [Fact]
    public async Task Client_Send_round_trips_through_command_worker()
    {
        var port = FreeTcpPort();
        var endpoint = $"tcp://127.0.0.1:{port}";

        var workerInbound = new RecordingInbound
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

        await using var bus = await Start(endpoint, workerInbound, new RecordingInbound());

        var reply = await bus.Client.Send(
            new BusMessage
            {
                MessageType = "EchoApi",
                Payload = BusJson.Serialize(new EchoBody("hello")),
                CorrelationId = Guid.NewGuid().ToString("N"),
            }
        );

        reply.Error.ShouldBeNull();
        BusJson.Deserialize<EchoResult>(reply.Payload!).Echo.ShouldBe("hello");
        workerInbound.Handled.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Client_Publish_is_delivered_to_command_worker()
    {
        var port = FreeTcpPort();
        var endpoint = $"tcp://127.0.0.1:{port}";
        var workerInbound = new RecordingInbound();
        await using var bus = await Start(endpoint, workerInbound, new RecordingInbound());

        await bus.Client.Publish(
            new BusMessage
            {
                MessageType = "StatusChangedEvent",
                Payload = BusJson.Serialize(new EchoBody("open")),
            }
        );

        await WaitUntil(() => workerInbound.Delivered.Count > 0);
        workerInbound.Delivered.ShouldHaveSingleItem().MessageType.ShouldBe("StatusChangedEvent");
    }

    [Fact]
    public async Task Command_worker_Publish_reaches_client()
    {
        var port = FreeTcpPort();
        var endpoint = $"tcp://127.0.0.1:{port}";
        var clientInbound = new RecordingInbound();
        await using var bus = await Start(endpoint, new RecordingInbound(), clientInbound);

        await bus.Worker.Publish(
            new BusMessage
            {
                MessageType = "StatusChangedEvent",
                Payload = BusJson.Serialize(new EchoBody("fulfilled")),
            }
        );

        await WaitUntil(() => clientInbound.Delivered.Count > 0);
        clientInbound.Delivered.ShouldHaveSingleItem().MessageType.ShouldBe("StatusChangedEvent");
    }

    static async Task<Bus> Start(
        string endpoint,
        RecordingInbound workerInbound,
        RecordingInbound clientInbound
    )
    {
        var broker = new ZeroMqBroker(
            new ZeroMqBrokerOptions { BindEndpoint = endpoint, CommandAddress = "work-items" },
            NullLogger<ZeroMqBroker>.Instance
        );
        var worker = Client(endpoint, "work-items", workerInbound);
        var client = Client(endpoint, "orchestrator", clientInbound);
        await broker.StartAsync(CancellationToken.None);
        await worker.StartAsync(CancellationToken.None);
        await client.StartAsync(CancellationToken.None);
        await Task.Delay(100);
        return new Bus(broker, worker, client);
    }

    static ZeroMqMessageBusProvider Client(string endpoint, string address, IMessageBusInbound inbound) =>
        new(
            new ZeroMqBusOptions { Endpoint = endpoint, Address = address },
            inbound,
            NullLogger<ZeroMqMessageBusProvider>.Instance
        );

    static async Task WaitUntil(Func<bool> ready)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(2);
        while (!ready() && DateTime.UtcNow < deadline)
        {
            await Task.Delay(25);
        }
    }

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

    sealed class Bus : IAsyncDisposable
    {
        public ZeroMqMessageBusProvider Worker { get; }
        public ZeroMqMessageBusProvider Client { get; }
        readonly ZeroMqBroker _broker;

        public Bus(
            ZeroMqBroker broker,
            ZeroMqMessageBusProvider worker,
            ZeroMqMessageBusProvider client
        )
        {
            _broker = broker;
            Worker = worker;
            Client = client;
        }

        public ValueTask DisposeAsync()
        {
            Client.Dispose();
            Worker.Dispose();
            _broker.Dispose();
            return ValueTask.CompletedTask;
        }
    }

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
