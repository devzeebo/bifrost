using Bifrost.MessageBus;

namespace Bifrost.WorkItems.Contracts;

[BusAddress("work-items")]
public static class ChangeWorkItemStatusApi
{
    public sealed record Command : WorkItemCommand
    {
        public required Guid Id { get; init; }
        public required WorkItemStatus Status { get; init; }

        /// <summary>
        /// Optional idempotency key. A retry with a key the item has already applied
        /// succeeds without re-checking <see cref="WorkItemCommand.Expected"/> or appending
        /// another status event.
        /// </summary>
        public string? RequestKey
        {
            get;
            init
            {
                field = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
            }
        }
    }
}
