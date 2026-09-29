using Bifrost.MessageBus;
using Bifrost.Tests;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Shouldly;
using Wolverine;

namespace Bifrost.Tests.MessageBus;

public class BifrostWolverineBusTests
{
    [Fact]
    public async Task published_event_is_invoked_as_a_wolverine_handler()
    {
        var heard = new Heard();
        var builder = Host.CreateApplicationBuilder();
        builder.Services.AddSingleton(heard);
        builder.UseWolverine(opts =>
        {
            opts.Discovery.DisableConventionalDiscovery();
            opts.Discovery.IncludeType<HeardHandler>();
            opts.UseBifrostBus().ListenFor<HeardMessage>();
        });
        builder.Services.AddLoopbackBifrostBus();

        using var host = builder.Build();
        await host.StartAsync();
        try
        {
            var bus = host.Services.GetRequiredService<IBifrostBus>();
            await bus.Publish(new HeardMessage { Name = "node-1" });

            var deadline = DateTime.UtcNow.AddSeconds(5);
            while (DateTime.UtcNow < deadline && heard.Names.Count == 0)
            {
                await Task.Delay(20);
            }

            heard.Names.ShouldBe(["node-1"]);
        }
        finally
        {
            await host.StopAsync();
        }
    }

    public sealed record HeardMessage
    {
        public required string Name { get; init; }
    }

    public class HeardHandler
    {
        public static void Handle(HeardMessage message, Heard heard) => heard.Names.Add(message.Name);
    }

    public sealed class Heard
    {
        public List<string> Names { get; } = [];
    }
}
