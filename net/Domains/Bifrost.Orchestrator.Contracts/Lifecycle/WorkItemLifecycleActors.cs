namespace Bifrost.Orchestrator.Contracts;

public static class WorkItemLifecycleActors
{
    public const string Orchestrator = "orchestrator";

    public static string ForSystem() => Orchestrator;

    public static string ForRequester(string requester)
    {
        if (string.IsNullOrWhiteSpace(requester))
        {
            throw new ContractValidationException("Requester is required.");
        }

        return requester.Trim();
    }
}
