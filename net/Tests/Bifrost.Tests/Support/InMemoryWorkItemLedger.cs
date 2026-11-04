using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.WorkItems.Contracts;

namespace Bifrost.Tests.Support;

/// <summary>
/// Test stand-in for the work-items status ledger used by orchestrator mirror calls.
/// </summary>
public sealed class InMemoryWorkItemLedger
{
    readonly ConcurrentDictionary<Guid, Entry> _items = new();

    public void Seed(Guid id, string status = "pending") =>
        _items[id] = new Entry(status.Trim().ToLowerInvariant(), [], new HashSet<string>(StringComparer.Ordinal));

    public string? StatusOf(Guid id) => _items.TryGetValue(id, out var entry) ? entry.Status : null;

    public IReadOnlyList<HistoryEntry> HistoryOf(Guid id) =>
        _items.TryGetValue(id, out var entry) ? entry.History : [];

    public void Apply(ChangeWorkItemStatusApi.Command command)
    {
        if (!_items.TryGetValue(command.Id, out var entry))
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.Validation,
                    Message = "Work item no longer matches the expected state.",
                }
            );
        }

        if (command.RequestKey is { Length: > 0 } key && entry.AppliedRequestKeys.Contains(key))
        {
            return;
        }

        if (command.Expected is { Count: > 0 })
        {
            var expectedStatus = command.Expected["status"]?.GetValue<string>();
            if (
                expectedStatus is not null
                && !string.Equals(expectedStatus, entry.Status, StringComparison.Ordinal)
            )
            {
                throw new BusException(
                    new BusError
                    {
                        Code = BusErrorCodes.Validation,
                        Message =
                            $"Work item no longer matches the expected state (expected status '{expectedStatus}', actual '{entry.Status}').",
                    }
                );
            }
        }

        var next = ((string)command.Status).Trim().ToLowerInvariant();
        var history = entry.History.ToList();
        history.Add(new HistoryEntry(next, command.Actor, command.Reason));
        var keys = new HashSet<string>(entry.AppliedRequestKeys, StringComparer.Ordinal);
        if (command.RequestKey is { Length: > 0 } applied)
        {
            keys.Add(applied);
        }

        _items[command.Id] = new Entry(next, history, keys);
    }

    sealed record Entry(
        string Status,
        List<HistoryEntry> History,
        HashSet<string> AppliedRequestKeys
    );

    public sealed record HistoryEntry(string Status, string Actor, string Reason);
}
