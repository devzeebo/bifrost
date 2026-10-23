using System.Text.Json;
using System.Text.Json.Nodes;
using Bifrost.Rpc;

namespace Bifrost.MessageBus;

public static class BusJson
{
    public static readonly JsonSerializerOptions Options = RpcSession.SerializerOptions;

    public static JsonNode Serialize<T>(T value) =>
        JsonSerializer.SerializeToNode(value, Options)
        ?? throw new InvalidOperationException($"Failed to serialize {typeof(T).Name}.");

    public static T Deserialize<T>(JsonNode payload) =>
        payload.Deserialize<T>(Options)
        ?? throw new InvalidOperationException($"Failed to deserialize {typeof(T).Name}.");

    /// <summary>
    /// Nested Api types use the declaring type name (<c>ChangeWorkItemStatusApi.Command</c> →
    /// <c>ChangeWorkItemStatusApi</c>). Everything else uses its own type name.
    /// </summary>
    public static string MessageTypeOf(Type type) => type.DeclaringType?.Name ?? type.Name;
}
