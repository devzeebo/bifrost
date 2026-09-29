using Bifrost.MessageBus;
using Bifrost.Rpc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Bifrost.MessageBus.ZeroMq;

static class EntryPoint
{
    static async Task Main(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args);
        builder.Services.AddLogging(logging => logging.AddConsole());

        if (
            string.Equals(
                Environment.GetEnvironmentVariable("BUS_ROLE"),
                "broker",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            builder.Services.AddSingleton(ZeroMqBrokerOptions.FromEnvironment());
            builder.Services.AddSingleton<ZeroMqBroker>();
            builder.Services.AddHostedService(sp => sp.GetRequiredService<ZeroMqBroker>());
        }
        else
        {
            builder.Services.AddSingleton(ZeroMqBusOptions.FromEnvironment());
            builder.Services.AddRpcPeer();
            builder.Services.AddMessageBusProvider<ZeroMqMessageBusProvider>();
            builder.Services.AddHostedService(sp =>
                sp.GetRequiredService<ZeroMqMessageBusProvider>()
            );
        }

        var host = builder.Build();
        await host.RunAsync();
    }
}
