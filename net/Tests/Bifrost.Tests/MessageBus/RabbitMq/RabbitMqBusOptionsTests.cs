using Bifrost.MessageBus.RabbitMq;
using Microsoft.Extensions.Configuration;
using Shouldly;

namespace Bifrost.Tests.MessageBus.RabbitMq;

public class RabbitMqBusOptionsTests
{
    [Fact]
    public void FromConfiguration_binds_the_bus_section()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["Bus:Address"] = "orchestrator",
                    ["Bus:Endpoint"] = "amqp://example/",
                    ["Bus:Subscribers:0"] = "work-items",
                    ["Bus:Subscribers:1"] = "orchestrator",
                    ["Bus:NodeId"] = "node-1",
                }
            )
            .Build();

        var options = RabbitMqBusOptions.FromConfiguration(configuration);

        options.Address.ShouldBe("orchestrator");
        options.Endpoint.ShouldBe("amqp://example/");
        options.Subscribers.ShouldBe(["work-items", "orchestrator"]);
        options.NodeId.ShouldBe("node-1");
    }

    [Fact]
    public void FromConfiguration_defaults_endpoint_and_subscribers_and_requires_address()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["Bus:Address"] = "worker", ["Bus:NodeId"] = " " }
            )
            .Build();

        var options = RabbitMqBusOptions.FromConfiguration(configuration);

        options.Endpoint.ShouldBe("amqp://bifrost:bifrost@rabbitmq:5672/");
        options.Subscribers.ShouldBe(["work-items", "orchestrator", "worker"]);
        options.NodeId.ShouldBeNull();

        Should.Throw<InvalidOperationException>(
            () => RabbitMqBusOptions.FromConfiguration(new ConfigurationBuilder().Build())
        );
    }
}
