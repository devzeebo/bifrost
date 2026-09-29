using Bifrost.MessageBus;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Wolverine;
using Bifrost.Rpc;
using Bifrost.WorkerNode;
using JasperFx.Resources;

var builder = Host.CreateApplicationBuilder(args);

var socketPath =
    builder.Configuration["Bifrost:BusSocket"]
    ?? Environment.GetEnvironmentVariable("BIFROST_BUS_SOCKET")
    ?? "/run/bifrost/bus.sock";

var outboxPath =
    builder.Configuration["Bifrost:OutboxPath"]
    ?? Environment.GetEnvironmentVariable("BIFROST_OUTBOX_PATH")
    ?? "worker-node.db";

var nodeId = Guid.TryParse(Environment.GetEnvironmentVariable("BIFROST_WORKER_NODE_ID"), out var configured)
    ? configured
    : Guid.NewGuid();

builder.Services.AddSingleton(new WorkerNodeIdentity { Id = nodeId });

builder.Services.AddRpcHost(options =>
{
    options.SocketPath = socketPath;
    options.LaunchProcesses = false;
    options.WaitForReadyOnStart = true;
    options.Instances = [new RpcInstanceOptions { Id = "bus", Role = RpcRole.Primary }];
});

builder.Services.AddMessageBus();
builder.Services.AddResourceSetupOnStartup();

builder.UseWolverine(opts => WorkerNodeWolverine.Configure(opts, outboxPath));
builder.Services.AddHostedService<WorkerRegistrationService>();

var host = builder.Build();
await host.RunAsync();
