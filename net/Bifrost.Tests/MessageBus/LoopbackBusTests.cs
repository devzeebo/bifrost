using Bifrost.MessageBus;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;

namespace Bifrost.Tests.MessageBus;

public class LoopbackBusTests
{
    [Fact]
    public async Task Request_round_trips_through_a_typed_handler()
    {
        var services = new ServiceCollection();
        services.AddMessageBusHandler<EchoApi.Command, EchoApi.Response>(
            (_, command, _) =>
                Task.FromResult(new EchoApi.Response { Value = $"echo:{command.Payload}" })
        );
        services.AddLoopbackBifrostBus();

        await using var provider = services.BuildServiceProvider();
        var bus = provider.GetRequiredService<IBifrostBus>();

        var response = await bus.Request<EchoApi.Command, EchoApi.Response>(
            new EchoApi.Command { Payload = "hi" }
        );

        response.Value.ShouldBe("echo:hi");
    }

    [Fact]
    public async Task Request_propagates_BusError_as_BusException()
    {
        var services = new ServiceCollection();
        services.AddMessageBusHandler<EchoApi.Command, EchoApi.Response>(
            (_, _, _) =>
                throw new BusException(
                    new BusError { Code = BusErrorCodes.Validation, Message = "bad payload" }
                )
        );
        services.AddLoopbackBifrostBus();

        await using var provider = services.BuildServiceProvider();
        var bus = provider.GetRequiredService<IBifrostBus>();

        var ex = await Should.ThrowAsync<BusException>(() =>
            bus.Request<EchoApi.Command, EchoApi.Response>(new EchoApi.Command { Payload = "x" })
        );

        ex.Error.Code.ShouldBe(BusErrorCodes.Validation);
        ex.Error.Message.ShouldBe("bad payload");
    }

    [Fact]
    public async Task Publish_delivers_to_subscribers()
    {
        var received = new List<string>();
        var services = new ServiceCollection();
        services.AddMessageBusSubscriber<StatusChangedEvent>(
            (_, e, _) =>
            {
                received.Add(e.Status);
                return Task.CompletedTask;
            }
        );
        services.AddLoopbackBifrostBus();

        await using var provider = services.BuildServiceProvider();
        var bus = provider.GetRequiredService<IBifrostBus>();

        await bus.Publish(new StatusChangedEvent { Status = "open" });

        received.ShouldBe(["open"]);
    }

    [Fact]
    public async Task Unknown_MessageType_returns_not_found()
    {
        var services = new ServiceCollection();
        services.AddLoopbackBifrostBus();

        await using var provider = services.BuildServiceProvider();
        var bus = provider.GetRequiredService<IBifrostBus>();

        var ex = await Should.ThrowAsync<BusException>(() =>
            bus.Request<EchoApi.Command, EchoApi.Response>(new EchoApi.Command { Payload = "x" })
        );

        ex.Error.Code.ShouldBe(BusErrorCodes.NotFound);
    }
}
