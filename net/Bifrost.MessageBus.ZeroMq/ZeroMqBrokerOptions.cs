namespace Bifrost.MessageBus.ZeroMq;

sealed class ZeroMqBrokerOptions
{
    /// <summary>ROUTER bind address, e.g. <c>tcp://*:5555</c>.</summary>
    public required string BindEndpoint { get; init; }

    /// <summary>Sidecar identity that handles <c>req</c> frames.</summary>
    public string CommandAddress { get; init; } = "work-items";

    public static ZeroMqBrokerOptions FromEnvironment()
    {
        return new ZeroMqBrokerOptions
        {
            BindEndpoint = Environment.GetEnvironmentVariable("BUS_BIND") ?? "tcp://*:5555",
            CommandAddress =
                Environment.GetEnvironmentVariable("BUS_COMMAND_ADDRESS") ?? "work-items",
        };
    }
}
