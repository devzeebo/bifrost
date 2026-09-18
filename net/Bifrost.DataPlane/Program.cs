using Bifrost;
using Bifrost.MessageBus;
using Bifrost.Rpc;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Wolverine;
using Wolverine.Marten;

var builder = Host.CreateApplicationBuilder(args);

var connectionString =
    builder.Configuration["ConnectionStrings:Marten"]
    ?? throw new InvalidOperationException("Connection string 'Marten' is required.");

var socketPath =
    builder.Configuration["Bifrost:BusSocket"]
    ?? Environment.GetEnvironmentVariable("BIFROST_BUS_SOCKET")
    ?? "/run/bifrost/bus.sock";

builder
    .Services.AddMarten(opts =>
    {
        opts.Connection(connectionString);
        MartenConfiguration.Configure(opts);
    })
    .IntegrateWithWolverine()
    .ApplyAllDatabaseChangesOnStartup();

builder.UseWolverine(opts =>
{
    opts.Discovery.IncludeAssembly(typeof(MartenConfiguration).Assembly);
    opts.Policies.AutoApplyTransactions();
});

builder.Services.AddRpcHost(options =>
{
    options.SocketPath = socketPath;
    options.LaunchProcesses = false;
    options.WaitForReadyOnStart = false;
    options.Instances = [new RpcInstanceOptions { Id = "bus", Role = RpcRole.Primary }];
});

builder.Services.AddMessageBus();
DataPlaneBusRegistration.AddHandlers(builder.Services);

var host = builder.Build();
await host.RunAsync();
