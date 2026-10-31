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
        _items[id] = new Entry(status.Trim().ToLowerInvariant(), []);

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
                        Message = "Work item no longer matches the expected state.",
                    }
                );
            }
        }

        var next = ((string)command.Status).Trim().ToLowerInvariant();
        var history = entry.History.ToList();
        history.Add(new HistoryEntry(next, command.Actor, command.Reason));
        _items[command.Id] = new Entry(next, history);
    }

    sealed record Entry(string Status, List<HistoryEntry> History);

    public sealed record HistoryEntry(string Status, string Actor, string Reason);
}
