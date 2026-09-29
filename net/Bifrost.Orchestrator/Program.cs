using Bifrost;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using JasperFx;
using JasperFx.CodeGeneration;
using Wolverine.Runtime.Heartbeat;
using Marten;
using Wolverine;
using Wolverine.Marten;

var builder = WebApplication.CreateBuilder(args);

var connectionString =
    builder.Configuration["ConnectionStrings:Marten"]
    ?? throw new InvalidOperationException("Connection string 'Marten' is required.");

var socketPath =
    builder.Configuration["Bifrost:BusSocket"]
    ?? Environment.GetEnvironmentVariable(RpcConnectionKeys.SocketEnv)
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
    opts.ApplicationAssembly = typeof(MartenConfiguration).Assembly;
    opts.CodeGeneration.TypeLoadMode = TypeLoadMode.Static;
    opts.CodeGeneration.GeneratedCodeOutputPath = Path.GetFullPath(
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "Internal", "Generated")
    );
    opts.Discovery.IncludeAssembly(typeof(MartenConfiguration).Assembly);
    opts.Policies.AutoApplyTransactions();
    opts.UseBifrostBus()
        .ListenFor<WorkerNodeRegistered.Command>()
        .ListenFor<WolverineHeartbeat>();
});

builder.Services.AddRpcHost(options =>
{
    options.SocketPath = socketPath;
    options.LaunchProcesses = false;
    options.WaitForReadyOnStart = false;
    options.Instances = [new RpcInstanceOptions { Id = "orchestrator", Role = RpcRole.Primary }];
});

builder.Services.AddMessageBus();
builder.Services.AddWolverineHttp();

var app = builder.Build();

app.MapWolverineEndpoints();

if (args is ["codegen", ..])
{
    return await app.RunJasperFxCommands(args);
}

app.Run();
return 0;

public partial class Program;
