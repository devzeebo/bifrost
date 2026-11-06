using System.Collections.Concurrent;

namespace Bifrost.Capabilities.Evals;

public sealed class EvalRunCancellation
{
    readonly ConcurrentDictionary<Guid, CancellationTokenSource> _sources = new();

    public CancellationToken GetToken(Guid suiteRunId) =>
        _sources.GetOrAdd(suiteRunId, static _ => new CancellationTokenSource()).Token;

    public void Cancel(Guid suiteRunId)
    {
        if (_sources.TryGetValue(suiteRunId, out var cts))
        {
            cts.Cancel();
        }
    }

    public void Complete(Guid suiteRunId)
    {
        if (_sources.TryRemove(suiteRunId, out var cts))
        {
            cts.Dispose();
        }
    }
}
