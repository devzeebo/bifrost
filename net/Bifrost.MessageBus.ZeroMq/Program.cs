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

        var busOptions = ZeroMqBusOptions.FromEnvironment();
        builder.Services.AddSingleton(busOptions);
        builder.Services.AddLogging(logging => logging.AddConsole());

        builder.Services.AddRpcPeer();
        builder.Services.AddMessageBusProvider<ZeroMqMessageBusProvider>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<ZeroMqMessageBusProvider>());

        var host = builder.Build();
        await host.RunAsync();
    }
}
