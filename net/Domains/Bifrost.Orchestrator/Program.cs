using System.Net.Http.Headers;
using Bifrost;
using Bifrost.Configuration;
using Bifrost.Gateway;
using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.Rpc;
using Bifrost.TrackedWorkItems;
using JasperFx;
using JasperFx.CodeGeneration;
using Marten;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Wolverine;
using Wolverine.Marten;
using Wolverine.Runtime.Heartbeat;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddVariableExpansion();

var connectionString =
    builder.Configuration["ConnectionStrings:Marten"]
    ?? throw new InvalidOperationException("Connection string 'Marten' is required.");

var socketPath = builder.Configuration["Bifrost:BusSocket"] ?? "/run/bifrost/bus.sock";

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
    // ProcessWorkItemDispatch / CreateRun / DeliverClaimedWork cascades are enlisted in
    // Marten's transactional outbox (IntegrateWithWolverine + OutboxedSessionFactory) with
    // the claim/create/release commit — a crash after commit still reloads and flushes them.
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
builder.Services.AddTrackedWorkItemBusQueries();
builder.Services.AddGatewayQuota(builder.Configuration);
builder.Services.AddWolverineHttp();

var app = builder.Build();

app.Use(
    async (context, next) =>
    {
        if (
            string.Equals(context.Request.Method, "QUERY", StringComparison.OrdinalIgnoreCase)
            && context.Request.Path.Equals(
                "/get-virtual-key-quota",
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            var gateway = context
                .RequestServices.GetRequiredService<IOptions<GatewayOptions>>()
                .Value;
            if (string.IsNullOrWhiteSpace(gateway.QuotaAccessToken))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status401Unauthorized,
                        Title = "Quota access denied",
                        Detail =
                            "Gateway:QuotaAccessToken is required before HTTP quota lookups are allowed.",
                    }
                );
                return;
            }

            var authorized = false;
            var header = context.Request.Headers.Authorization.ToString();
            if (
                AuthenticationHeaderValue.TryParse(header, out var auth)
                && string.Equals(auth.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase)
                && auth.Parameter == gateway.QuotaAccessToken
            )
            {
                authorized = true;
            }

            if (!authorized)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status401Unauthorized,
                        Title = "Quota access denied",
                        Detail = "Missing or invalid quota access token.",
                    }
                );
                return;
            }
        }

        try
        {
            await next();
        }
        catch (CommandValidationException ex)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid command",
                    Detail = ex.Message,
                }
            );
        }
        catch (ContractValidationException ex)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid command",
                    Detail = ex.Message,
                }
            );
        }
        catch (JasperFx.Events.EventStreamUnexpectedMaxEventIdException)
        {
            // Concurrent aggregate append — treat as a lost expected-state race.
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid command",
                    Detail =
                        "Tracked work item no longer matches the expected state.",
                }
            );
        }
        catch (VirtualKeyQuotaException ex)
        {
            context.Response.StatusCode = ex.StatusCode;
            await context.Response.WriteAsJsonAsync(
                new ProblemDetails
                {
                    Status = ex.StatusCode,
                    Title = ex.StatusCode switch
                    {
                        StatusCodes.Status401Unauthorized => "Invalid virtual key",
                        StatusCodes.Status403Forbidden => "Virtual key expired",
                        StatusCodes.Status503ServiceUnavailable => "Gateway not configured",
                        _ => "Gateway unavailable",
                    },
                    Detail = ex.Message,
                }
            );
        }
    }
);

app.MapWolverineEndpoints();

if (args is ["codegen", ..])
{
    return await app.RunJasperFxCommands(args);
}

app.Run();
return 0;

public partial class Program;
