namespace Bifrost.Runs.Events;

public sealed record RunSucceeded
{
    public required string Actor { get; init; }
    public required string Reason { get; init; }
}
