namespace Bifrost.Orchestrator.Contracts;

public enum WorkItemLifecycleAction
{
    Claim,
    Start,
    Succeed,
    Fail,
    Release,
    Cancel,
}
