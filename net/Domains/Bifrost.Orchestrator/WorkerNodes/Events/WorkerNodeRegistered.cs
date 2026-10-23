using System.Text.Json.Serialization;

namespace Bifrost.WorkerNodes.Events;

public sealed record WorkerNodeRegistered
{
    [JsonConstructor]
    internal WorkerNodeRegistered(Guid id) => Id = id;

    public Guid Id { get; init; }
}
