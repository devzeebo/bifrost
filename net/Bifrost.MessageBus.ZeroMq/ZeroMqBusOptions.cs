namespace Bifrost.MessageBus.ZeroMq;

enum BusMode
{
    Server,
    Client,
}

sealed class ZeroMqBusOptions
{
    public BusMode Mode { get; init; } = BusMode.Server;

    /// <summary>
    /// ROUTER bind address when server (e.g. <c>tcp://*:5555</c>), or DEALER connect address
    /// when client (e.g. <c>tcp://data-bus:5555</c>).
    /// </summary>
    public required string RouterEndpoint { get; init; }

    public static ZeroMqBusOptions FromEnvironment()
    {
        var modeRaw = Environment.GetEnvironmentVariable("BUS_MODE") ?? "server";
        if (!Enum.TryParse<BusMode>(modeRaw, ignoreCase: true, out var mode))
        {
            throw new InvalidOperationException(
                $"BUS_MODE must be 'server' or 'client', got '{modeRaw}'."
            );
        }

        var endpoint =
            Environment.GetEnvironmentVariable("BUS_ROUTER_ENDPOINT")
            ?? (mode == BusMode.Server ? "tcp://*:5555" : "tcp://data-bus:5555");

        return new ZeroMqBusOptions { Mode = mode, RouterEndpoint = endpoint };
    }
}
