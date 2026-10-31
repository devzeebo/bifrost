using Bifrost.Orchestrator.Contracts;
using Shouldly;

namespace Bifrost.Tests.TrackedWorkItems;

public class WorkItemLifecycleTests
{
    readonly WorkItemLifecycleDefinition _lifecycle = DefaultWorkItemLifecycle.Definition;

    [Theory]
    [InlineData(TrackedWorkItemStatuses.Pending, WorkItemLifecycleAction.Claim, TrackedWorkItemStatuses.Claimed)]
    [InlineData(TrackedWorkItemStatuses.Claimed, WorkItemLifecycleAction.Start, TrackedWorkItemStatuses.Running)]
    [InlineData(TrackedWorkItemStatuses.Running, WorkItemLifecycleAction.Succeed, TrackedWorkItemStatuses.Succeeded)]
    [InlineData(TrackedWorkItemStatuses.Running, WorkItemLifecycleAction.Fail, TrackedWorkItemStatuses.Failed)]
    [InlineData(TrackedWorkItemStatuses.Claimed, WorkItemLifecycleAction.Release, TrackedWorkItemStatuses.Pending)]
    [InlineData(TrackedWorkItemStatuses.Running, WorkItemLifecycleAction.Release, TrackedWorkItemStatuses.Pending)]
    public void happy_path_edges(
        string from,
        WorkItemLifecycleAction action,
        string expected
    ) => WorkItemLifecycle.Decide(_lifecycle, from, action).ShouldBe(expected);

    [Theory]
    [InlineData(TrackedWorkItemStatuses.Pending)]
    [InlineData(TrackedWorkItemStatuses.Claimed)]
    [InlineData(TrackedWorkItemStatuses.Running)]
    public void cancel_is_legal_from_every_non_terminal(string from) =>
        WorkItemLifecycle
            .Decide(_lifecycle, from, WorkItemLifecycleAction.Cancel)
            .ShouldBe(TrackedWorkItemStatuses.Canceled);

    [Theory]
    [InlineData(TrackedWorkItemStatuses.Succeeded)]
    [InlineData(TrackedWorkItemStatuses.Failed)]
    [InlineData(TrackedWorkItemStatuses.Canceled)]
    public void terminals_reject_all_actions(string terminal)
    {
        foreach (var action in Enum.GetValues<WorkItemLifecycleAction>())
        {
            Should
                .Throw<ContractValidationException>(() =>
                    WorkItemLifecycle.Decide(_lifecycle, terminal, action)
                )
                .Message.ShouldContain(terminal);
        }
    }

    [Fact]
    public void claim_from_running_is_illegal() =>
        Should
            .Throw<ContractValidationException>(() =>
                WorkItemLifecycle.Decide(
                    _lifecycle,
                    TrackedWorkItemStatuses.Running,
                    WorkItemLifecycleAction.Claim
                )
            )
            .Message.ShouldContain("running");

    [Fact]
    public void abandoned_is_not_a_lifecycle_status()
    {
        _lifecycle.TerminalStatuses.ShouldNotContain("abandoned");
        _lifecycle.InitialStatus.ShouldNotBe("abandoned");
        _lifecycle.CanceledStatus.ShouldNotBe("abandoned");
    }

    [Fact]
    public void alternate_lifecycle_definition_is_independent()
    {
        var alternate = new WorkItemLifecycleDefinition(
            "open",
            "closed",
            ["closed", "done"],
            [("open", WorkItemLifecycleAction.Succeed, "done")]
        );

        WorkItemLifecycle
            .Decide(alternate, "open", WorkItemLifecycleAction.Succeed)
            .ShouldBe("done");
        WorkItemLifecycle
            .Decide(alternate, "open", WorkItemLifecycleAction.Cancel)
            .ShouldBe("closed");
        Should.Throw<ContractValidationException>(() =>
            WorkItemLifecycle.Decide(alternate, "open", WorkItemLifecycleAction.Claim)
        );
    }

    [Fact]
    public void extension_state_is_cancelable_by_non_terminal_rule()
    {
        var withPause = new WorkItemLifecycleDefinition(
            TrackedWorkItemStatuses.Pending,
            TrackedWorkItemStatuses.Canceled,
            [
                TrackedWorkItemStatuses.Succeeded,
                TrackedWorkItemStatuses.Failed,
                TrackedWorkItemStatuses.Canceled,
            ],
            [
                (
                    TrackedWorkItemStatuses.Pending,
                    WorkItemLifecycleAction.Claim,
                    TrackedWorkItemStatuses.Claimed
                ),
                (TrackedWorkItemStatuses.Running, WorkItemLifecycleAction.Release, "paused"),
                ("paused", WorkItemLifecycleAction.Start, TrackedWorkItemStatuses.Running),
            ]
        );

        WorkItemLifecycle
            .Decide(withPause, "paused", WorkItemLifecycleAction.Cancel)
            .ShouldBe(TrackedWorkItemStatuses.Canceled);
    }

    [Fact]
    public void terminal_statuses_cannot_declare_outgoing_edges() =>
        Should.Throw<ArgumentException>(() =>
            new WorkItemLifecycleDefinition(
                "pending",
                "canceled",
                ["canceled"],
                [("canceled", WorkItemLifecycleAction.Claim, "pending")]
            )
        );

    [Fact]
    public void system_actor_is_orchestrator() =>
        WorkItemLifecycleActors.ForSystem().ShouldBe("orchestrator");

    [Fact]
    public void requester_actor_requires_identity()
    {
        WorkItemLifecycleActors.ForRequester("alice").ShouldBe("alice");
        Should.Throw<ContractValidationException>(() => WorkItemLifecycleActors.ForRequester(" "));
    }
}
