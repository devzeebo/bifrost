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
    IOptions<WorkerLivenessOptions> options,
    ILogger<WorkerLivenessDetector> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Grace period: give the bus time to drain queued heartbeats after restart so a
        // healthy worker is not declared offline on a stale LastHeartbeatAt from downtime.
        var grace = SilenceThreshold();
        try
        {
            await Task.Delay(grace, stoppingToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = CheckInterval();

            try
            {
                await Task.Delay(delay, stoppingToken).ConfigureAwait(false);
                await Sweep(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Worker liveness sweep failed; retrying next interval.");
            }
        }
    }

    async Task Sweep(CancellationToken cancellationToken)
    {
        var threshold = SilenceThreshold();
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
            try
            {
                await bus.InvokeAsync(
                        new DeclareWorkerOffline { WorkerId = workerId },
                        cancellationToken
                    )
                    .ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Failed to declare worker {WorkerId} offline; continuing sweep.",
                    workerId
                );
            }
        }
    }

    TimeSpan SilenceThreshold()
    {
        var threshold = options.Value.SilenceThreshold;
        return threshold <= TimeSpan.Zero ? TimeSpan.FromSeconds(5) : threshold;
    }

    TimeSpan CheckInterval()
    {
        var interval = options.Value.CheckInterval;
        return interval <= TimeSpan.Zero ? TimeSpan.FromSeconds(1) : interval;
    }
}
