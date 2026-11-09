namespace Bifrost.WorkerNodes.Events;

public sealed record WorkerDeclaredOffline
{
    public required DateTimeOffset At { get; init; }
}
