using Bifrost.MessageBus;
using Bifrost.Rpc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Bifrost.MessageBus.RabbitMq;

static class EntryPoint
{
    static async Task Main(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args);
        builder.Services.AddLogging(logging => logging.AddConsole());
        builder.Services.AddSingleton(RabbitMqBusOptions.FromEnvironment());
        builder.Services.AddRpcPeer();
        builder.Services.AddMessageBusProvider<RabbitMqMessageBusProvider>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<RabbitMqMessageBusProvider>());

        var host = builder.Build();
        await host.RunAsync();
    }
}
