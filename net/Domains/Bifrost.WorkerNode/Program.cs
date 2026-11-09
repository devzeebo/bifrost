using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.WorkerNode;
using JasperFx;
using JasperFx.Resources;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Wolverine;

var builder = Host.CreateApplicationBuilder(args);

var socketPath = string.IsNullOrWhiteSpace(builder.Configuration["Bifrost:BusSocket"])
    ? "/run/bifrost/bus.sock"
    : builder.Configuration["Bifrost:BusSocket"]!;
var outboxPath = string.IsNullOrWhiteSpace(builder.Configuration["Bifrost:OutboxPath"])
    ? "worker-node.db"
    : builder.Configuration["Bifrost:OutboxPath"]!;
var nodeId = WorkerNodeIdentityStore.Resolve(
    outboxPath,
    builder.Configuration["Bifrost:NodeId"]
);

builder.Services.Configure<HarnessHostOptions>(
    builder.Configuration.GetSection(HarnessHostOptions.SectionName)
);
builder.Services.AddSingleton(new WorkerNodeIdentity { Id = nodeId });
builder.Services.AddSingleton<IHarnessAcceptStore>(_ => new HarnessAcceptStore(outboxPath));
builder.Services.AddSingleton<IHarnessRunGate, HarnessRunGate>();
builder.Services.AddSingleton<HarnessExecutionSlot>();
builder.Services.AddSingleton<IHarnessProcessRunner, HarnessProcessRunner>();
builder.Services.AddSingleton<IHarnessJobScheduler, WolverineHarnessJobScheduler>();

builder.Services.AddRpcHost(options =>
{
    options.SocketPath = socketPath;
    options.LaunchProcesses = false;
    options.WaitForReadyOnStart = true;
    options.Instances = [new RpcInstanceOptions { Id = "worker", Role = RpcRole.Primary }];
});

builder.Services.AddMessageBus();
builder.Services.AddMessageBusHandler<ExecuteClaimedWorkApi.Command>(
    async (sp, command, ct) =>
    {
        await ExecuteClaimedWorkHandler.Handle(
            command,
            sp.GetRequiredService<IBifrostBus>(),
            sp.GetRequiredService<IHarnessJobScheduler>(),
            sp.GetRequiredService<WorkerNodeIdentity>(),
            sp.GetRequiredService<IHarnessAcceptStore>()
        );
    }
);
builder.Services.AddMessageBusHandler<KillHarnessProcessesApi.Command>(
    async (sp, command, _) =>
    {
        await KillHarnessProcessesHandler.Handle(
            command,
            sp.GetRequiredService<WorkerNodeIdentity>(),
            sp.GetRequiredService<IHarnessAcceptStore>(),
            sp.GetRequiredService<IHarnessRunGate>()
        );
    }
);
builder.Services.AddResourceSetupOnStartup();

builder.UseWolverine(opts => WorkerNodeWolverine.Configure(opts, outboxPath, nodeId));
builder.Services.AddHostedService<WorkerRegistrationService>();

var host = builder.Build();
return await host.RunJasperFxCommands(args);
