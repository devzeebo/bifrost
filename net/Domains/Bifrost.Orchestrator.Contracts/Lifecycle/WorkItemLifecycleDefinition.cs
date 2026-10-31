namespace Bifrost.Orchestrator.Contracts;

public sealed class WorkItemLifecycleDefinition
{
    readonly Dictionary<(string From, WorkItemLifecycleAction Action), string> _transitions;

    public WorkItemLifecycleDefinition(
        string initialStatus,
        string canceledStatus,
        IEnumerable<string> terminalStatuses,
        IEnumerable<(string From, WorkItemLifecycleAction Action, string To)> transitions
    )
    {
        InitialStatus = TrackedWorkItemStatuses.Normalize(initialStatus);
        CanceledStatus = TrackedWorkItemStatuses.Normalize(canceledStatus);
        TerminalStatuses = terminalStatuses
            .Select(TrackedWorkItemStatuses.Normalize)
            .ToHashSet(StringComparer.Ordinal);
        _transitions = transitions.ToDictionary(
            t => (TrackedWorkItemStatuses.Normalize(t.From), t.Action),
            t => TrackedWorkItemStatuses.Normalize(t.To)
        );

        if (TerminalStatuses.Count == 0)
        {
            throw new ArgumentException("At least one terminal status is required.", nameof(terminalStatuses));
        }

        if (!TerminalStatuses.Contains(CanceledStatus))
        {
            throw new ArgumentException(
                $"Canceled status '{CanceledStatus}' must be terminal.",
                nameof(canceledStatus)
            );
        }

        foreach (var terminal in TerminalStatuses)
        {
            if (_transitions.Keys.Any(key => key.From == terminal))
            {
                throw new ArgumentException(
                    $"Terminal status '{terminal}' cannot have outgoing transitions.",
                    nameof(transitions)
                );
            }
        }
    }

    public string InitialStatus { get; }

    public string CanceledStatus { get; }

    public IReadOnlySet<string> TerminalStatuses { get; }

    public bool IsTerminal(string status) =>
        TerminalStatuses.Contains(TrackedWorkItemStatuses.Normalize(status));

    public bool TryGetTransition(
        string currentStatus,
        WorkItemLifecycleAction action,
        out string nextStatus
    )
    {
        return _transitions.TryGetValue(
            (TrackedWorkItemStatuses.Normalize(currentStatus), action),
            out nextStatus!
        );
    }
}
