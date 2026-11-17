using System.Collections.Concurrent;
using Bifrost.MessageBus;
using Bifrost.Workflows.Contracts;

namespace Bifrost.Tests.Support;

public sealed class InMemoryWorkflowCatalog
{
    readonly ConcurrentDictionary<Guid, GetWorkflowApi.Response> _workflows = new();

    public void Seed(GetWorkflowApi.Response workflow) => _workflows[workflow.Id] = workflow;

    public GetWorkflowApi.Response Get(Guid id)
    {
        if (!_workflows.TryGetValue(id, out var workflow))
        {
            throw new BusException(
                new BusError
                {
                    Code = BusErrorCodes.NotFound,
                    Message = $"Workflow {id} not found.",
                }
            );
        }

        return workflow;
    }
}
