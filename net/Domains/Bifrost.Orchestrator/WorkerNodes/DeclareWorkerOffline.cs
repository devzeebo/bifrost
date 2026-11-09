namespace Bifrost.WorkerNodes;

/// <summary>Internal system signal that a worker has been quiet past the silence threshold.</summary>
public sealed record DeclareWorkerOffline
{
    public required Guid WorkerId { get; init; }
}
