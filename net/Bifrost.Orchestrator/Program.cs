using Bifrost;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Marten;
using Wolverine;
using Wolverine.Marten;

var builder = WebApplication.CreateBuilder(args);

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

builder.Host.UseWolverine(opts =>
{
    opts.Discovery.IncludeAssembly(typeof(MartenConfiguration).Assembly);
    opts.Policies.AutoApplyTransactions();
    opts.UseBifrostBus()
        .ListenFor<WorkerNodeRegistered.Event>()
        .ListenFor<WorkerNodeHeartbeat.Event>();
});

builder.Services.AddRpcHost(options =>
{
    options.SocketPath = socketPath;
    options.LaunchProcesses = false;
    options.WaitForReadyOnStart = false;
    options.Instances = [new RpcInstanceOptions { Id = "bus", Role = RpcRole.Primary }];
});

builder.Services.AddMessageBus();
builder.Services.AddWolverineHttp();

var app = builder.Build();

app.MapWolverineEndpoints();

app.Run();

public partial class Program;
