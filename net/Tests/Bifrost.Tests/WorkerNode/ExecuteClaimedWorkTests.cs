using Bifrost.MessageBus;
using Bifrost.Orchestrator.Contracts;
using Bifrost.WorkerNode;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class ExecuteClaimedWorkTests
{
    [Fact]
    public async Task accepts_when_still_held_and_is_idempotent()
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        using var accepts = new HarnessAcceptStore(db);
        var workItemId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var bus = new StubBus(identity.Id, TrackedWorkItemStatuses.Claimed);
        var jobs = new RecordingJobs();

        var command = new ExecuteClaimedWorkApi.Command
        {
            WorkItemId = workItemId,
            WorkerId = identity.Id,
            RunId = runId,
        };

        await ExecuteClaimedWorkHandler.Handle(command, bus, jobs, identity, accepts);
        accepts.GetState(workItemId, runId).ShouldBe(HarnessAcceptState.Accepted);
        jobs.Jobs.ShouldHaveSingleItem().RunId.ShouldBe(runId);
        bus.Lookups.ShouldBe(1);

        await ExecuteClaimedWorkHandler.Handle(command, bus, jobs, identity, accepts);
        jobs.Jobs.Count.ShouldBe(1);
        bus.Lookups.ShouldBe(1);
    }

    [Fact]
    public async Task ignores_wrong_node_and_terminal_items()
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var db = Path.Combine(Path.GetTempPath(), $"harness-accept-{Guid.NewGuid():N}.db");
        using var accepts = new HarnessAcceptStore(db);
        var workItemId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var jobs = new RecordingJobs();

        await ExecuteClaimedWorkHandler.Handle(
            new ExecuteClaimedWorkApi.Command
            {
                WorkItemId = workItemId,
                WorkerId = Guid.NewGuid(),
                RunId = runId,
            },
            new StubBus(identity.Id, TrackedWorkItemStatuses.Claimed),
            jobs,
            identity,
            accepts
        );
        accepts.GetState(workItemId, runId).ShouldBeNull();
        jobs.Jobs.ShouldBeEmpty();

        await ExecuteClaimedWorkHandler.Handle(
            new ExecuteClaimedWorkApi.Command
            {
                WorkItemId = workItemId,
                WorkerId = identity.Id,
                RunId = runId,
            },
            new StubBus(identity.Id, TrackedWorkItemStatuses.Canceled),
            jobs,
            identity,
            accepts
        );
        accepts.GetState(workItemId, runId).ShouldBeNull();
        jobs.Jobs.ShouldBeEmpty();
    }

    sealed class RecordingJobs : IHarnessJobScheduler
    {
        public List<ExecuteHarness> Jobs { get; } = [];

        public Task Enqueue(ExecuteHarness job, CancellationToken cancellationToken = default)
        {
            Jobs.Add(job);
            return Task.CompletedTask;
        }
    }

    sealed class StubBus(Guid holderId, string status) : IBifrostBus
    {
        public int Lookups { get; private set; }

        public Task<TResponse> Request<TRequest, TResponse>(
            TRequest request,
            CancellationToken cancellationToken = default
        )
        {
            if (request is GetTrackedWorkItemApi.Query)
            {
                Lookups++;
                object response = new GetTrackedWorkItemApi.Response
                {
                    Id = Guid.NewGuid(),
                    Status = status,
                    HolderId = holderId,
                };
                return Task.FromResult((TResponse)response);
            }

            throw new NotSupportedException();
        }

        public Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
