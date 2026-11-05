using Bifrost.Capabilities.Aggregate;
using Bifrost.Capabilities.Events;
using Bifrost.Capabilities.Projections;
using Marten;
using Wolverine.Marten;

namespace Bifrost.Capabilities.Commands;

public static class CreateCapabilityHandler
{
    public static async Task Validate(CreateCapabilityApi.Command command, IQuerySession session)
    {
        if (string.IsNullOrWhiteSpace(command.Name))
        {
            throw new CommandValidationException("Name is required.");
        }

        if (string.IsNullOrWhiteSpace(command.Ask))
        {
            throw new CommandValidationException("Ask is required.");
        }

        if (await session.LoadAsync<CapabilityView.Model>(command.Id) is not null)
        {
            throw new CommandValidationException($"Capability {command.Id} already exists.");
        }
    }

    [WolverinePost("/create-capability"), EmptyResponse]
    public static IStartStream Handle(CreateCapabilityApi.Command command) =>
        MartenOps.StartStream<Capability>(
            command.Id,
            new CapabilityCreated
            {
                Id = command.Id,
                Name = command.Name.Trim(),
                Ask = command.Ask.Trim(),
            }
        );
}
