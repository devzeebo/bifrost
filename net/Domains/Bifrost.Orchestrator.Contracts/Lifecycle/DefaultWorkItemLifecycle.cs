namespace Bifrost.Orchestrator.Contracts;

public static class DefaultWorkItemLifecycle
{
    public static WorkItemLifecycleDefinition Definition { get; } =
        new(
            TrackedWorkItemStatuses.Pending,
            TrackedWorkItemStatuses.Canceled,
            [
                TrackedWorkItemStatuses.Succeeded,
                TrackedWorkItemStatuses.Failed,
                TrackedWorkItemStatuses.Canceled,
            ],
            [
                (
                    TrackedWorkItemStatuses.Pending,
                    WorkItemLifecycleAction.Claim,
                    TrackedWorkItemStatuses.Claimed
                ),
                (
                    TrackedWorkItemStatuses.Claimed,
                    WorkItemLifecycleAction.Start,
                    TrackedWorkItemStatuses.Running
                ),
                (
                    TrackedWorkItemStatuses.Running,
                    WorkItemLifecycleAction.Succeed,
                    TrackedWorkItemStatuses.Succeeded
                ),
                (
                    TrackedWorkItemStatuses.Running,
                    WorkItemLifecycleAction.Fail,
                    TrackedWorkItemStatuses.Failed
                ),
                (
                    TrackedWorkItemStatuses.Claimed,
                    WorkItemLifecycleAction.Release,
                    TrackedWorkItemStatuses.Pending
                ),
                (
                    TrackedWorkItemStatuses.Running,
                    WorkItemLifecycleAction.Release,
                    TrackedWorkItemStatuses.Pending
                ),
            ]
        );
}
