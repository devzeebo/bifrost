using Bifrost.MessageBus;

namespace Bifrost.Workflows.Contracts;

/// <summary>
/// Track an already-created attached work item (no worker dispatch) and advance the run.
/// </summary>
[BusAddress("workflows")]
public static class StartAttachedWorkflowApi
{
    public sealed record Command
    {
        public required Guid WorkItemId { get; init; }
        public required string Actor
        {
            get;
            init
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    throw new ContractValidationException("Actor is required.");
                }

                field = value.Trim();
            }
        }
        public required string Reason
        {
            get;
            init
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    throw new ContractValidationException("Reason is required.");
                }

                field = value.Trim();
            }
        }
    }
}
