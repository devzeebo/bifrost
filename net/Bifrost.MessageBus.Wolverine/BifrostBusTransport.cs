using Microsoft.Extensions.DependencyInjection;
using Wolverine;
using Wolverine.Configuration;
using Wolverine.Runtime;
using Wolverine.Transports;
using Wolverine.Transports.Sending;

namespace Bifrost.MessageBus;

sealed class BifrostBusTransport : TransportBase<BifrostBusEndpoint>
{
    readonly BifrostBusEndpoint _endpoint = new();

    public BifrostBusTransport()
        : base("bifrost", "Bifrost bus", []) { }

    protected override IEnumerable<BifrostBusEndpoint> endpoints() => [_endpoint];

    protected override BifrostBusEndpoint findEndpointByUri(Uri uri) =>
        uri == _endpoint.Uri
            ? _endpoint
            : throw new ArgumentException($"Unknown bifrost endpoint '{uri}'.", nameof(uri));
}

/// <summary>The single Wolverine endpoint for <see cref="IBifrostBus"/>.</summary>
public sealed class BifrostBusEndpoint : Endpoint
{
    public static readonly Uri Address = new("bifrost://bus");

    public BifrostBusEndpoint()
        : base(Address, EndpointRole.Application)
    {
        Mode = EndpointMode.Durable;
    }

    protected override ISender CreateSender(IWolverineRuntime runtime) => new BifrostBusSender(runtime);

    public override ValueTask<IListener> BuildListenerAsync(
        IWolverineRuntime runtime,
        IReceiver receiver
    ) => throw new NotSupportedException("Bifrost bus listening is registered by UseBifrostBus.");
}

sealed class BifrostBusSender(IWolverineRuntime runtime) : ISender
{
    public bool SupportsNativeScheduledSend => false;
    public Uri Destination { get; } = BifrostBusEndpoint.Address;

    public Task<bool> PingAsync() => Task.FromResult(true);

    public async ValueTask SendAsync(Envelope envelope)
    {
        var message =
            envelope.Message ?? throw new InvalidOperationException("Envelope has no message.");
        var bus = runtime.Services.GetRequiredService<IBifrostBus>();
        await bus.Publish((dynamic)message).ConfigureAwait(false);
    }
}
