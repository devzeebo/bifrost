namespace Bifrost.WorkerNode;

/// <summary>Serializes harness process execution to one at a time per worker.</summary>
public sealed class HarnessExecutionSlot : IAsyncDisposable
{
    readonly SemaphoreSlim _gate = new(1, 1);

    public async Task<IAsyncDisposable> Acquire(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        return new Releaser(_gate);
    }

    public ValueTask DisposeAsync()
    {
        _gate.Dispose();
        return ValueTask.CompletedTask;
    }

    sealed class Releaser(SemaphoreSlim gate) : IAsyncDisposable
    {
        public ValueTask DisposeAsync()
        {
            gate.Release();
            return ValueTask.CompletedTask;
        }
    }
}