using System.Text.Json.Nodes;
using Bifrost.MessageBus;

namespace Bifrost.Workflows.Contracts;

[BusAddress("workflows")]
public static class CreateAttachedWorkItemApi
{
    public sealed record Command
    {
        public required Guid WorkItemId { get; init; }
        public required Guid WorkflowId { get; init; }
        public required JsonNode Data { get; init; }
        public required string Status
        {
            get;
            init
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    throw new ContractValidationException("Status is required.");
                }

                field = value.Trim().ToLowerInvariant();
            }
        }
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
