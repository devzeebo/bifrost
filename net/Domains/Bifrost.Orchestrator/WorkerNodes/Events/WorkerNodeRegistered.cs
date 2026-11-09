using System.Text.Json.Serialization;

namespace Bifrost.WorkerNodes.Events;

public sealed record WorkerNodeRegistered
{
    [JsonConstructor]
    internal WorkerNodeRegistered(Guid id, DateTimeOffset at)
    {
        Id = id;
        At = at;
    }

    public Guid Id { get; init; }
    public DateTimeOffset At { get; init; }
}
