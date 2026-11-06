using System.Text.Json;

namespace Bifrost.Ai;

public sealed record ModelRequest
{
    /// <summary>When null or empty, <see cref="AiClientOptions.Model"/> is used.</summary>
    public string? Model { get; init; }
    public required IReadOnlyList<JsonElement> Input { get; init; }
    public required IReadOnlyList<FunctionTool> Tools { get; init; }

    /// <summary>
    /// Reserved for harness parity (engine affinity later); unused by the OpenAI client today.
    /// </summary>
    public required string SessionId { get; init; }
    public string? Instructions { get; init; }
}

public sealed record FunctionTool
{
    public required string Name { get; init; }
    public required string Description { get; init; }
    public required bool Strict { get; init; }
    public required JsonElement Parameters { get; init; }
}

public sealed record ModelResponse
{
    public required string Status { get; init; }
    public required string OutputText { get; init; }
    public required IReadOnlyList<JsonElement> Output { get; init; }
    public LineUsage? Usage { get; init; }
}

public interface IModelClient
{
    Task<ModelResponse> CreateResponse(ModelRequest request, CancellationToken ct = default);
}
