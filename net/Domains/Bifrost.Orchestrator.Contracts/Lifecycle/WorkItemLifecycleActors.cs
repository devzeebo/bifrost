namespace Bifrost.Orchestrator.Contracts;

public static class WorkItemLifecycleActors
{
    public const string Orchestrator = "orchestrator";

    public static string ForSystem() => Orchestrator;

    public static string ForWorker(Guid workerId)
    {
        if (workerId == Guid.Empty)
        {
            throw new ContractValidationException("WorkerId is required.");
        }

        return workerId.ToString("D");
    }

    public static string ForRequester(string requester)
    {
        if (string.IsNullOrWhiteSpace(requester))
        {
            throw new ContractValidationException("Requester is required.");
        }

        return requester.Trim();
    }

    public static bool TryParseWorker(string actor, out Guid workerId) =>
        Guid.TryParse(actor, out workerId) && workerId != Guid.Empty;
}
