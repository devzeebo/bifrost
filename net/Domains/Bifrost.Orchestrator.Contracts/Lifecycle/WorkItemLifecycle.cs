namespace Bifrost.Orchestrator.Contracts;

public static class WorkItemLifecycle
{
    public static string Decide(
        WorkItemLifecycleDefinition definition,
        string currentStatus,
        WorkItemLifecycleAction action
    )
    {
        ArgumentNullException.ThrowIfNull(definition);

        var current = TrackedWorkItemStatuses.Normalize(currentStatus);

        if (definition.IsTerminal(current))
        {
            throw new ContractValidationException(
                $"Cannot {Format(action)} work item in terminal status '{current}'."
            );
        }

        if (action == WorkItemLifecycleAction.Cancel)
        {
            return definition.CanceledStatus;
        }

        if (!definition.TryGetTransition(current, action, out var next))
        {
            throw new ContractValidationException(
                $"Cannot {Format(action)} work item from status '{current}'."
            );
        }

        return next;
    }

    public static void EnsureLegal(
        WorkItemLifecycleDefinition definition,
        string currentStatus,
        WorkItemLifecycleAction action
    ) => Decide(definition, currentStatus, action);

    static string Format(WorkItemLifecycleAction action) =>
        action switch
        {
            WorkItemLifecycleAction.Claim => "claim",
            WorkItemLifecycleAction.Start => "start",
            WorkItemLifecycleAction.Succeed => "succeed",
            WorkItemLifecycleAction.Fail => "fail",
            WorkItemLifecycleAction.Release => "release",
            WorkItemLifecycleAction.Cancel => "cancel",
            _ => action.ToString().ToLowerInvariant(),
        };
}
