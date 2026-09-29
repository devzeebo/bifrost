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

        await using var worker = Client(endpoint, "work-items-send", "work-items-send", subscribers, workerInbound);
        await using var client = Client(endpoint, "client-send", "work-items-send", subscribers, new RecordingInbound());
        await worker.StartAsync(CancellationToken.None);
        await client.StartAsync(CancellationToken.None);

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
        workerInbound.Handled.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Client_Publish_is_delivered_to_another_subscriber()
    {
        var endpoint = _rabbit.GetConnectionString();
        var subscribers = new[] { "publisher-live", "subscriber-live" };
        var subscriberInbound = new RecordingInbound();
        await using var publisher = Client(endpoint, "publisher-live", "unused", subscribers, new RecordingInbound());
        await using var subscriber = Client(endpoint, "subscriber-live", "unused", subscribers, subscriberInbound);
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
        subscriberInbound.Delivered.ShouldHaveSingleItem().MessageType.ShouldBe("StatusChangedEvent");
    }

    [Fact]
    public async Task Publish_is_kept_until_the_subscriber_starts()
    {
        var endpoint = _rabbit.GetConnectionString();
        var subscribers = new[] { "publisher-late", "subscriber-late" };
        var subscriberInbound = new RecordingInbound();
        await using var publisher = Client(endpoint, "publisher-late", "unused", subscribers, new RecordingInbound());
        await publisher.StartAsync(CancellationToken.None);

        await publisher.Publish(
            new BusMessage
            {
                MessageType = "WorkerNodeRegistered",
                Payload = BusJson.Serialize(new EchoBody("node")),
            }
        );

        await using var subscriber = Client(endpoint, "subscriber-late", "unused", subscribers, subscriberInbound);
        await subscriber.StartAsync(CancellationToken.None);

        await WaitUntil(() => subscriberInbound.Delivered.Count > 0);
        subscriberInbound.Delivered.ShouldHaveSingleItem().MessageType.ShouldBe("WorkerNodeRegistered");
    }

    static RabbitMqMessageBusProvider Client(
        string endpoint,
        string address,
        string commandAddress,
        IReadOnlyList<string> subscribers,
        IMessageBusInbound inbound
    ) =>
        new(
            new RabbitMqBusOptions
            {
                Endpoint = endpoint,
                Address = address,
                CommandAddress = commandAddress,
                Subscribers = subscribers,
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

        public Task<BusReply> Handle(BusMessage message, CancellationToken cancellationToken = default)
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
