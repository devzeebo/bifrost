using Bifrost.WorkerNode;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class WorkerNodeIdentityStoreTests
{
    [Fact]
    public void configured_id_wins_and_is_stable_across_calls()
    {
        var dir = Path.Combine(Path.GetTempPath(), $"worker-id-{Guid.NewGuid():N}");
        Directory.CreateDirectory(dir);
        var outbox = Path.Combine(dir, "worker-node.db");
        var configured = Guid.NewGuid();

        WorkerNodeIdentityStore.Resolve(outbox, configured.ToString("D")).ShouldBe(configured);
        WorkerNodeIdentityStore.Resolve(outbox, configured.ToString("D")).ShouldBe(configured);
        File.Exists(Path.Combine(dir, "worker-node-id")).ShouldBeFalse();
    }

    [Fact]
    public void mints_and_reuses_durable_id_when_unconfigured()
    {
        var dir = Path.Combine(Path.GetTempPath(), $"worker-id-{Guid.NewGuid():N}");
        Directory.CreateDirectory(dir);
        var outbox = Path.Combine(dir, "worker-node.db");

        var first = WorkerNodeIdentityStore.Resolve(outbox, null);
        var second = WorkerNodeIdentityStore.Resolve(outbox, "");
        first.ShouldNotBe(Guid.Empty);
        second.ShouldBe(first);
        File.ReadAllText(Path.Combine(dir, "worker-node-id")).Trim().ShouldBe(first.ToString("D"));
    }
}
