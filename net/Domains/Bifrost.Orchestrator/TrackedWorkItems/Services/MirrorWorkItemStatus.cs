using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Rpc;
using Bifrost.WorkItems.Contracts;

namespace Bifrost.TrackedWorkItems.Services;

public static class MirrorWorkItemStatusHandler
{
    public sealed record Message
    {
        public required Guid Id { get; init; }
        public required string Status { get; init; }
        public required string Actor { get; init; }
        public required string Reason { get; init; }
        public string? ExpectedStatus { get; init; }
    }

    public static async Task Handle(Message message, IBifrostBus bus)
    {
        ArgumentNullException.ThrowIfNull(message);
        ArgumentNullException.ThrowIfNull(bus);

        try
        {
            await bus.Request<ChangeWorkItemStatusApi.Command, Unit>(
                new ChangeWorkItemStatusApi.Command
                {
                    Id = message.Id,
                    Status = message.Status,
                    Actor = message.Actor,
                    Reason = message.Reason,
                    Expected = message.ExpectedStatus is null
                        ? null
                        : new JsonObject { ["status"] = message.ExpectedStatus },
                }
            );
        }
        catch (BusException ex) when (ex.Error.Code == BusErrorCodes.Validation)
        {
            throw new CommandValidationException(ex.Error.Message);
        }
    }
}
