using System.Collections.Concurrent;

namespace Bifrost.WorkerNode;

/// <summary>
/// Tracks in-flight harness cancellation tokens by run id so attempt-targeted
/// kill directives can stop leftovers without touching a later attempt.
/// </summary>
public interface IHarnessRunGate
{
    IDisposable Begin(Guid runId, CancellationToken parent, out CancellationToken linked);

    void Cancel(Guid runId);
}

public sealed class HarnessRunGate : IHarnessRunGate
{
    readonly ConcurrentDictionary<Guid, CancellationTokenSource> _runs = new();

    public IDisposable Begin(Guid runId, CancellationToken parent, out CancellationToken linked)
    {
        var cts = CancellationTokenSource.CreateLinkedTokenSource(parent);
        _runs[runId] = cts;
        linked = cts.Token;
        return new Releaser(this, runId, cts);
    }

    public void Cancel(Guid runId)
    {
        if (_runs.TryGetValue(runId, out var cts))
        {
            try
            {
                cts.Cancel();
            }
            catch (ObjectDisposedException)
            {
                // already finished
            }
        }
    }

    void Remove(Guid runId, CancellationTokenSource cts)
    {
        if (_runs.TryRemove(new KeyValuePair<Guid, CancellationTokenSource>(runId, cts)))
        {
            cts.Dispose();
        }
    }

    sealed class Releaser(HarnessRunGate gate, Guid runId, CancellationTokenSource cts)
        : IDisposable
    {
        public void Dispose() => gate.Remove(runId, cts);
    }
}
