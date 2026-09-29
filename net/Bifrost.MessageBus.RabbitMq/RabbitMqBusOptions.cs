namespace Bifrost.MessageBus.RabbitMq;

sealed class RabbitMqBusOptions
{
    public const string EventsExchange = "bifrost.events";
    public const string CommandsQueue = "bifrost.commands";

    /// <summary>AMQP URI, e.g. <c>amqp://bifrost:bifrost@rabbitmq:5672/</c>.</summary>
    public required string Endpoint { get; init; }

    /// <summary>This sidecar's address. It consumes <c>bifrost.events.{Address}</c>.</summary>
    public required string Address { get; init; }

    /// <summary>Every service that must have a durable event queue, including ones not running yet.</summary>
    public required IReadOnlyList<string> Subscribers { get; init; }

    /// <summary>Sidecar that consumes <see cref="CommandsQueue"/>.</summary>
    public string CommandAddress { get; init; } = "work-items";

    public static string EventQueue(string address) => $"{EventsExchange}.{address}";

    public static RabbitMqBusOptions FromEnvironment()
    {
        var endpoint = Environment.GetEnvironmentVariable("BUS_ENDPOINT")
            ?? "amqp://bifrost:bifrost@rabbitmq:5672/";
        var address = Environment.GetEnvironmentVariable("BIFROST_INSTANCE_ID")
            ?? throw new InvalidOperationException("Missing instance id (BIFROST_INSTANCE_ID).");
        var subscribers = (
            Environment.GetEnvironmentVariable("BUS_SUBSCRIBERS") ?? "work-items,orchestrator,worker"
        )
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (subscribers.Length == 0)
        {
            throw new InvalidOperationException("BUS_SUBSCRIBERS is empty.");
        }

        return new RabbitMqBusOptions
        {
            Endpoint = endpoint,
            Address = address,
            Subscribers = subscribers,
            CommandAddress = Environment.GetEnvironmentVariable("BUS_COMMAND_ADDRESS") ?? "work-items",
        };
    }
}
