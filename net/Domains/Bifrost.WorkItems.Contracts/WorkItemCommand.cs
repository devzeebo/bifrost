using System.Text.Json.Nodes;

namespace Bifrost.WorkItems.Contracts;

public abstract record WorkItemCommand
{
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

    public JsonObject? Expected { get; init; }
}
