namespace Bifrost.WorkerNodes;

/// <summary>Internal handoff that publishes the durable kill directive to one worker node.</summary>
public sealed record DeliverKillHarnessProcesses
{
    public required Guid WorkerId { get; init; }
    public required Guid WorkItemId { get; init; }
    public required Guid RunId { get; init; }
}