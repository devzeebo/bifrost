using Bifrost.Contracts;
using Bifrost.ControlPlane;
using Bifrost.MessageBus;
using Bifrost.Rpc;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

var socketPath =
    builder.Configuration["Bifrost:BusSocket"]
    ?? Environment.GetEnvironmentVariable("BIFROST_BUS_SOCKET")
    ?? "/run/bifrost/bus.sock";

builder.Services.AddRpcHost(options =>
{
    options.SocketPath = socketPath;
    options.LaunchProcesses = false;
    options.WaitForReadyOnStart = false;
    options.Instances = [new RpcInstanceOptions { Id = "bus", Role = RpcRole.Primary }];
});
builder.Services.AddMessageBus();

var app = builder.Build();

app.Use(
    async (context, next) =>
    {
        try
        {
            await next();
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.Validation)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(
                new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid command",
                    Detail = ex.Error.Message,
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
    }
);

ControlPlaneEndpoints.Map(app);

app.Run();

public partial class Program;
