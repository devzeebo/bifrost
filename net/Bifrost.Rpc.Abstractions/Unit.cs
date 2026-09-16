namespace Bifrost.Rpc;

/// <summary>
/// Empty result for awaitable RPC requests with no payload.
/// Use <c>Task&lt;Unit&gt;</c> / <c>ValueTask&lt;Unit&gt;</c> when the caller must wait for completion
/// but there is nothing to return. Non-generic <c>Task</c> / <c>ValueTask</c> are notifications (fire-and-forget).
/// </summary>
public readonly struct Unit : IEquatable<Unit>
{
    public static Unit Value => default;

    public bool Equals(Unit other) => true;

    public override bool Equals(object? obj) => obj is Unit;

    public override int GetHashCode() => 0;

    public static bool operator ==(Unit left, Unit right) => true;

    public static bool operator !=(Unit left, Unit right) => false;
}
