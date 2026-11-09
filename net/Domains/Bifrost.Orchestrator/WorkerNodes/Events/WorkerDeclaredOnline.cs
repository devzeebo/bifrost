namespace Bifrost.WorkerNodes.Events;

public sealed record WorkerDeclaredOnline
{
    public required DateTimeOffset At { get; init; }
}
