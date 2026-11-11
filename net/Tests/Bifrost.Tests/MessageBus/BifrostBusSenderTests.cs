using Bifrost.MessageBus;
using JasperFx.Resources;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Wolverine;
using Wolverine.Runtime;
using Wolverine.Util;

namespace Bifrost.Tests.MessageBus;

public class BifrostBusSenderTests
{
    [Fact]
    public async Task send_rehydrates_message_when_durable_envelope_has_only_data()
    {
        var bus = new RecordingBus();
        var builder = Host.CreateApplicationBuilder();
        builder.Services.AddSingleton<IBifrostBus>(bus);
        builder.Services.AddResourceSetupOnStartup();
        builder.UseWolverine(opts =>
        {
            opts.Discovery.DisableConventionalDiscovery();
            opts.Discovery.IncludeType<PingHandler>();
            opts.UseBifrostBus();
            opts.PublishMessage<PingMessage>().To(BifrostBusEndpoint.Address);
            opts.Policies.UseDurableOutboxOnAllSendingEndpoints();
        });

        using var host = builder.Build();
        await host.StartAsync();
        try
        {
            var runtime = host.Services.GetRequiredService<IWolverineRuntime>();
            var envelope = new Envelope(new PingMessage { Value = "hello" })
            {
                Destination = BifrostBusEndpoint.Address,
                Serializer = runtime.Options.DefaultSerializer,
            };
            // Durable outbox stores Data + MessageType, then relays with Message null.
            // Envelope.Message setter clears MessageType when set to null — restore after serialize.
            var messageType = typeof(PingMessage).ToMessageTypeName();
            _ = envelope.Data;
            envelope.Message = null;
            envelope.MessageType = messageType;

            var sender = new BifrostBusSender(runtime);
            await sender.SendAsync(envelope);

            bus.Published.OfType<PingMessage>().ShouldHaveSingleItem().Value.ShouldBe("hello");
        }
        finally
        {
            await host.StopAsync();
        }
    }

    public sealed record PingMessage
    {
        public required string Value { get; init; }
    }

    public class PingHandler
    {
        public static void Handle(PingMessage _) { }
    }

    sealed class RecordingBus : IBifrostBus
    {
        public List<object> Published { get; } = [];

        public Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
        {
            lock (Published)
            {
                Published.Add(@event!);
            }

            return Task.CompletedTask;
        }

        public Task<TResponse> Request<TRequest, TResponse>(
            TRequest request,
            CancellationToken cancellationToken = default
        ) => throw new NotSupportedException();
    }
}
