namespace Bifrost.TrackedWorkItems.Workflow;

/// <summary>
/// Well-known relationship linking a node-execution work item to its attached root.
/// </summary>
public static class NodeExecutionRelationship
{
    public static Guid TypeId { get; } = Guid.Parse("a1150000-1111-4111-8111-000000000115");

    public const string ForwardWord = "node execution of";
    public const string InverseWord = "has node execution";
}
