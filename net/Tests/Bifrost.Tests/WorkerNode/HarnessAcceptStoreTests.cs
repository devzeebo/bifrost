using Bifrost.WorkerNode;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class HarnessAcceptStoreTests
{
    [Fact]
    public void accept_survives_reopen_and_blocks_second_accept()
    {
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        var workItemId = Guid.NewGuid();
        var runId = Guid.NewGuid();

        using (var first = new HarnessAcceptStore(db))
        {
            first.TryAccept(workItemId, runId).ShouldBeTrue();
            first.TryAccept(workItemId, runId).ShouldBeFalse();
            first.GetState(workItemId, runId).ShouldBe(HarnessAcceptState.Accepted);
        }

        using var second = new HarnessAcceptStore(db);
        second.GetState(workItemId, runId).ShouldBe(HarnessAcceptState.Accepted);
        second.TryAccept(workItemId, runId).ShouldBeFalse();
        second.TryBeginRunning(workItemId, runId).ShouldBeTrue();
        second.GetState(workItemId, runId).ShouldBe(HarnessAcceptState.Running);
        second.MarkConcluded(workItemId, runId);
        second.GetState(workItemId, runId).ShouldBe(HarnessAcceptState.Concluded);
        second.TryBeginRunning(workItemId, runId).ShouldBeFalse();
    }
}
