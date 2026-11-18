using Bifrost.MessageBus;

namespace Bifrost.Workflows.Contracts;

[BusAddress("workflows")]
public static class CancelAttachedWorkflowRootApi
{
    public sealed record Command
    {
        public required Guid RootWorkItemId { get; init; }
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
