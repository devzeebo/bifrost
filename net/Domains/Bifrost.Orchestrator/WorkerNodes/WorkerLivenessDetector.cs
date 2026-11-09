using Bifrost.WorkerNodes.Projections;
using Marten;
using Microsoft.Extensions.Options;
using Wolverine;

namespace Bifrost.WorkerNodes;

/// <summary>
/// Presence-only silence detector. Reads the heartbeat trail; never consults harness signals.
/// </summary>
public sealed class WorkerLivenessDetector(
    IServiceScopeFactory scopeFactory,
    IOptions<WorkerLivenessOptions> options
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var opts = options.Value;
            var delay = opts.CheckInterval <= TimeSpan.Zero
                ? TimeSpan.FromSeconds(1)
                : opts.CheckInterval;

            try
            {
                await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
                await Sweep(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
        }
    }

    async Task Sweep(CancellationToken cancellationToken)
    {
        var opts = options.Value;
        var threshold = opts.SilenceThreshold <= TimeSpan.Zero
            ? TimeSpan.FromSeconds(5)
            : opts.SilenceThreshold;
        var cutoff = DateTimeOffset.UtcNow - threshold;

        await using var scope = scopeFactory.CreateAsyncScope();
        var store = scope.ServiceProvider.GetRequiredService<IDocumentStore>();
        var bus = scope.ServiceProvider.GetRequiredService<IMessageBus>();

        await using var session = store.QuerySession();
        var quiet = await session
            .Query<WorkerNodeView.Model>()
            .Where(w =>
                w.IsOnline
                && w.LastHeartbeatAt != null
                && w.LastHeartbeatAt < cutoff
            )
            .Select(w => w.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        foreach (var workerId in quiet)
        {
            await bus.InvokeAsync(
                    new DeclareWorkerOffline { WorkerId = workerId },
                    cancellationToken
                )
                .ConfigureAwait(false);
        }
    }
}
