namespace Bifrost.WorkerNodes;

/// <summary>
/// Internal per-item death release: return the item to pending and abandon its open run
/// in one Marten commit, then deliver the attempt-targeted kill directive.
/// </summary>
public sealed record ReleaseHeldWorkForDeadWorker
{
    public required Guid WorkItemId { get; init; }
    public required Guid WorkerId { get; init; }
}
