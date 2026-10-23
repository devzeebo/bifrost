using Microsoft.Extensions.Configuration;

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

    public static RabbitMqBusOptions FromConfiguration(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var section = configuration.GetSection("Bus");

        var endpoint = section["Endpoint"];
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            endpoint = "amqp://bifrost:bifrost@rabbitmq:5672/";
        }

        var address = section["Address"];
        if (string.IsNullOrWhiteSpace(address))
        {
            throw new InvalidOperationException("Missing Bus:Address.");
        }

        var subscribersSection = section.GetSection("Subscribers");
        string[] subscribers;
        if (!subscribersSection.Exists())
        {
            subscribers = ["work-items", "orchestrator", "worker"];
        }
        else
        {
            subscribers = (subscribersSection.Get<string[]>() ?? [])
                .Where(subscriber => !string.IsNullOrWhiteSpace(subscriber))
                .ToArray();
            if (subscribers.Length == 0)
            {
                throw new InvalidOperationException("Bus:Subscribers is empty.");
            }
        }

        var nodeId = section["NodeId"];
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
