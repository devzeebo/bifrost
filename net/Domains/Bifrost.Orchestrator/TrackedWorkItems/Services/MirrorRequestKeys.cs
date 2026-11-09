using Bifrost.Orchestrator.Contracts;

namespace Bifrost.TrackedWorkItems.Services;

public static class MirrorRequestKeys
{
    public static string ForCreate(Guid id, string status) =>
        $"{id:D}:create:{TrackedWorkItemStatuses.Normalize(status)}";

    public static string For(
        Guid id,
        WorkItemLifecycleAction action,
        string fromStatus
    ) =>
        $"{id:D}:{action.ToString().ToLowerInvariant()}:{TrackedWorkItemStatuses.Normalize(fromStatus)}";

    public static string For(
        Guid id,
        WorkItemLifecycleAction action,
        string fromStatus,
        Guid runId
    ) =>
        $"{id:D}:{action.ToString().ToLowerInvariant()}:{TrackedWorkItemStatuses.Normalize(fromStatus)}:{runId:D}";
}
