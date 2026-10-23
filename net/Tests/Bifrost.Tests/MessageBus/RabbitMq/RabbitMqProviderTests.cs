using Bifrost.MessageBus;
using Bifrost.MessageBus.RabbitMq;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Testcontainers.RabbitMq;

namespace Bifrost.Tests.MessageBus.RabbitMq;

public sealed class RabbitMqProviderTests : IAsyncLifetime
{
    readonly RabbitMqContainer _rabbit = new RabbitMqBuilder("rabbitmq:3-management")
        .WithUsername("bifrost")
        .WithPassword("bifrost")
        .Build();

    public Task InitializeAsync() => _rabbit.StartAsync();

    public Task DisposeAsync() => _rabbit.DisposeAsync().AsTask();

    [Fact]
    public async Task Client_Send_round_trips_through_command_worker()
    {
        var endpoint = _rabbit.GetConnectionString();
        var subscribers = new[] { "client-send", "work-items-send" };
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

        await using var worker = Client(endpoint, "work-items-send", subscribers, workerInbound);
        await using var client = Client(
            endpoint,
            "client-send",
            subscribers,
            new RecordingInbound()
        );
        await worker.StartAsync(CancellationToken.None);
        await client.StartAsync(CancellationToken.None);

        var reply = await client.Send(
            new BusMessage
            {
                MessageType = "EchoApi",
                Address = "work-items-send",
                Payload = BusJson.Serialize(new EchoBody("hello")),
                CorrelationId = Guid.NewGuid().ToString("N"),
            }
        );

        reply.Error.ShouldBeNull();
        BusJson.Deserialize<EchoResult>(reply.Payload!).Echo.ShouldBe("hello");
        workerInbound.Handled.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Client_Publish_is_delivered_to_another_subscriber()
    {
        var endpoint = _rabbit.GetConnectionString();
        var subscribers = new[] { "publisher-live", "subscriber-live" };
        var subscriberInbound = new RecordingInbound();
        await using var publisher = Client(
            endpoint,
            "publisher-live",
            subscribers,
            new RecordingInbound()
        );
        await using var subscriber = Client(
            endpoint,
            "subscriber-live",
            subscribers,
            subscriberInbound
        );
        await publisher.StartAsync(CancellationToken.None);
        await subscriber.StartAsync(CancellationToken.None);

        await publisher.Publish(
            new BusMessage
            {
                MessageType = "StatusChangedEvent",
                Payload = BusJson.Serialize(new EchoBody("open")),
            }
        );

        await WaitUntil(() => subscriberInbound.Delivered.Count > 0);
        subscriberInbound
            .Delivered.ShouldHaveSingleItem()
            .MessageType.ShouldBe("StatusChangedEvent");
    }

    [Fact]
    public async Task Publish_is_kept_until_the_subscriber_starts()
    {
        var endpoint = _rabbit.GetConnectionString();
        var subscribers = new[] { "publisher-late", "subscriber-late" };
        var subscriberInbound = new RecordingInbound();
        await using var publisher = Client(
            endpoint,
            "publisher-late",
            subscribers,
            new RecordingInbound()
        );
        await publisher.StartAsync(CancellationToken.None);

        await publisher.Publish(
            new BusMessage
            {
                MessageType = "WorkerNodeRegistered",
                Payload = BusJson.Serialize(new EchoBody("node")),
            }
        );

        await using var subscriber = Client(
            endpoint,
            "subscriber-late",
            subscribers,
            subscriberInbound
        );
        await subscriber.StartAsync(CancellationToken.None);

        await WaitUntil(() => subscriberInbound.Delivered.Count > 0);
        subscriberInbound
            .Delivered.ShouldHaveSingleItem()
            .MessageType.ShouldBe("WorkerNodeRegistered");
    }

    [Fact]
    public async Task Send_to_a_container_is_handled_by_one_replica()
    {
        var endpoint = _rabbit.GetConnectionString();
        var subscribers = new[] { "sender-race", "work-items-race" };
        var first = new RecordingInbound();
        var second = new RecordingInbound();
        await using var replicaA = Client(endpoint, "work-items-race", subscribers, first);
        await using var replicaB = Client(endpoint, "work-items-race", subscribers, second);
        await using var sender = Client(
            endpoint,
            "sender-race",
            subscribers,
            new RecordingInbound()
        );
        await replicaA.StartAsync(CancellationToken.None);
        await replicaB.StartAsync(CancellationToken.None);
        await sender.StartAsync(CancellationToken.None);

        var reply = await sender.Send(
            new BusMessage
            {
                MessageType = "EchoApi",
                Address = "work-items-race",
                Payload = BusJson.Serialize(new EchoBody("one")),
                CorrelationId = Guid.NewGuid().ToString("N"),
            }
        );

        reply.Error.ShouldBeNull();
        await WaitUntil(() => first.Handled.Count + second.Handled.Count > 0);
        await Task.Delay(250);
        (first.Handled.Count + second.Handled.Count).ShouldBe(1);
    }

    [Fact]
    public async Task Send_with_node_affinity_reaches_only_that_node()
    {
        var endpoint = _rabbit.GetConnectionString();
        var subscribers = new[] { "sender-pin", "worker-pin" };
        var pinned = new RecordingInbound();
        var other = new RecordingInbound();
        await using var node123 = Client(
            endpoint,
            "worker-pin",
            subscribers,
            pinned,
            nodeId: "123"
        );
        await using var node456 = Client(endpoint, "worker-pin", subscribers, other, nodeId: "456");
        await using var sender = Client(
            endpoint,
            "sender-pin",
            subscribers,
            new RecordingInbound()
        );
        await node123.StartAsync(CancellationToken.None);
        await node456.StartAsync(CancellationToken.None);
        await sender.StartAsync(CancellationToken.None);

        var reply = await sender.Send(
            new BusMessage
            {
                MessageType = "EchoApi",
                Address = "worker-pin:123",
                Payload = BusJson.Serialize(new EchoBody("pinned")),
                CorrelationId = Guid.NewGuid().ToString("N"),
            }
        );

        reply.Error.ShouldBeNull();
        await WaitUntil(() => pinned.Handled.Count > 0);
        await Task.Delay(250);
        pinned.Handled.Count.ShouldBe(1);
        other.Handled.Count.ShouldBe(0);
    }

    static RabbitMqMessageBusProvider Client(
        string endpoint,
        string address,
        IReadOnlyList<string> subscribers,
        IMessageBusInbound inbound,
        string? nodeId = null
    ) =>
        new(
            new RabbitMqBusOptions
            {
                Endpoint = endpoint,
                Address = address,
                Subscribers = subscribers,
                NodeId = nodeId,
            },
            inbound,
            NullLogger<RabbitMqMessageBusProvider>.Instance
        );

    static async Task WaitUntil(Func<bool> ready)
    {
        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(10);
        while (!ready() && DateTime.UtcNow < deadline)
        {
            await Task.Delay(25);
        }
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
