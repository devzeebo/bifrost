namespace Bifrost.MessageBus.ZeroMq;

sealed class ZeroMqBusOptions
{
    /// <summary>Broker address this sidecar dials, e.g. <c>tcp://bus:5555</c>.</summary>
    public required string Endpoint { get; init; }

    /// <summary>DEALER identity. The broker uses it to route replies and publishes.</summary>
    public required string Address { get; init; }

    public static ZeroMqBusOptions FromEnvironment()
    {
        var endpoint = Environment.GetEnvironmentVariable("BUS_ENDPOINT") ?? "tcp://bus:5555";
        var address =
            Environment.GetEnvironmentVariable("BIFROST_INSTANCE_ID")
            ?? throw new InvalidOperationException("Missing instance id (BIFROST_INSTANCE_ID).");

        return new ZeroMqBusOptions { Endpoint = endpoint, Address = address };
    }
}
