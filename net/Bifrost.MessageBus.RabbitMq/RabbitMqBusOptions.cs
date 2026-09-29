namespace Bifrost.MessageBus.RabbitMq;

sealed class RabbitMqBusOptions
{
    public const string EventsExchange = "bifrost.events";
    public const string CommandsPrefix = "bifrost.commands";

    /// <summary>AMQP URI, e.g. <c>amqp://bifrost:bifrost@rabbitmq:5672/</c>.</summary>
    public required string Endpoint { get; init; }

    /// <summary>This sidecar's container. It consumes <c>bifrost.commands.{Address}</c>.</summary>
    public required string Address { get; init; }

    /// <summary>Every service that must have a durable event queue, including ones not running yet.</summary>
    public required IReadOnlyList<string> Subscribers { get; init; }

    /// <summary>
    /// When set, this sidecar also consumes <c>bifrost.commands.{Address}:{NodeId}</c>.
    /// </summary>
    public string? NodeId { get; init; }

    public static string EventQueue(string address) => $"{EventsExchange}.{address}";

    public static string CommandQueue(string address) => $"{CommandsPrefix}.{address}";

    /// <summary>Text before the first <c>:</c>. The node id, when present, is the remainder.</summary>
    public static string ContainerOf(string address)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(address);
        var split = address.IndexOf(':');
        if (split == 0 || split == address.Length - 1)
        {
            throw new InvalidOperationException($"Invalid command address '{address}'.");
        }

        return split < 0 ? address : address[..split];
    }

    public static RabbitMqBusOptions FromEnvironment()
    {
        var endpoint =
            Environment.GetEnvironmentVariable("BUS_ENDPOINT")
            ?? "amqp://bifrost:bifrost@rabbitmq:5672/";
        var address =
            Environment.GetEnvironmentVariable("BIFROST_INSTANCE_ID")
            ?? throw new InvalidOperationException("Missing instance id (BIFROST_INSTANCE_ID).");
        var subscribers = (
            Environment.GetEnvironmentVariable("BUS_SUBSCRIBERS")
            ?? "work-items,orchestrator,worker"
        ).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (subscribers.Length == 0)
        {
            throw new InvalidOperationException("BUS_SUBSCRIBERS is empty.");
        }

        var nodeId = Environment.GetEnvironmentVariable("BIFROST_NODE_ID");
        if (string.IsNullOrWhiteSpace(nodeId))
        {
            nodeId = null;
        }

        return new RabbitMqBusOptions
        {
            Endpoint = endpoint,
            Address = address,
            Subscribers = subscribers,
            NodeId = nodeId,
        };
    }
}
