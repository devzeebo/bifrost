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
        var accepted = new AcceptedClaimedWork();
        var workItemId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var bus = new StubBus(identity.Id, TrackedWorkItemStatuses.Claimed);

        var command = new ExecuteClaimedWorkApi.Command
        {
            WorkItemId = workItemId,
            WorkerId = identity.Id,
            RunId = runId,
        };

        await ExecuteClaimedWorkHandler.Handle(command, bus, identity, accepted);
        accepted.Contains(workItemId, runId).ShouldBeTrue();
        bus.Lookups.ShouldBe(1);

        await ExecuteClaimedWorkHandler.Handle(command, bus, identity, accepted);
        bus.Lookups.ShouldBe(1);
    }

    [Fact]
    public async Task ignores_wrong_node_and_terminal_items()
    {
        var identity = new WorkerNodeIdentity { Id = Guid.NewGuid() };
        var accepted = new AcceptedClaimedWork();
        var workItemId = Guid.NewGuid();
        var runId = Guid.NewGuid();

        await ExecuteClaimedWorkHandler.Handle(
            new ExecuteClaimedWorkApi.Command
            {
                WorkItemId = workItemId,
                WorkerId = Guid.NewGuid(),
                RunId = runId,
            },
            new StubBus(identity.Id, TrackedWorkItemStatuses.Claimed),
            identity,
            accepted
        );
        accepted.Contains(workItemId, runId).ShouldBeFalse();

        await ExecuteClaimedWorkHandler.Handle(
            new ExecuteClaimedWorkApi.Command
            {
                WorkItemId = workItemId,
                WorkerId = identity.Id,
                RunId = runId,
            },
            new StubBus(identity.Id, TrackedWorkItemStatuses.Canceled),
            identity,
            accepted
        );
        accepted.Contains(workItemId, runId).ShouldBeFalse();
    }

    sealed class StubBus(Guid holderId, string status) : IBifrostBus
    {
        public int Lookups { get; private set; }

        public Task<TResponse> Request<TRequest, TResponse>(
            TRequest request,
            CancellationToken cancellationToken = default
        )
        {
            if (request is GetTrackedWorkItemApi.Query query)
            {
                Lookups++;
                object response = new GetTrackedWorkItemApi.Response
                {
                    Id = query.Id,
                    Status = status,
                    HolderId = holderId,
                };
                return Task.FromResult((TResponse)response);
            }

            throw new InvalidOperationException($"Unexpected request {typeof(TRequest).Name}");
        }

        public Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
