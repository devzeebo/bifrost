using System.Text.Json.Nodes;

namespace Bifrost.MessageBus;

/// <summary>Opaque envelope that crosses the RPC socket and the broker hop.</summary>
public sealed record BusMessage
{
    /// <summary>Api class name used for routing, e.g. <c>ChangeWorkItemStatusApi</c>.</summary>
    public required string MessageType { get; init; }

    public required JsonNode Payload { get; init; }

    public string? CorrelationId { get; init; }
}

public sealed record BusReply
{
    public JsonNode? Payload { get; init; }

    public BusError? Error { get; init; }
}

public sealed record BusError
{
    /// <summary>
    /// Stable code the control plane maps to HTTP status. Use <see cref="BusErrorCodes.Validation"/>
    /// for domain validation failures.
    /// </summary>
    public required string Code { get; init; }

    public required string Message { get; init; }
}

public static class BusErrorCodes
{
    public const string Validation = "validation";
    public const string NotFound = "not_found";
    public const string Internal = "internal";
}
