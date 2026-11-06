using Bifrost.Capabilities.Evals;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Commands;

public static class CancelEvalSuiteRunHandler
{
    public static async Task Validate(
        CancelEvalSuiteRunApi.Command command,
        IQuerySession session
    )
    {
        if (await session.LoadAsync<EvalSuiteRunDocument>(command.SuiteRunId) is null)
        {
            throw new CommandValidationException($"Suite run {command.SuiteRunId} not found.");
        }
    }

    [WolverinePost("/cancel-eval-suite-run")]
    public static async Task<CancelEvalSuiteRunApi.Response> Handle(
        CancelEvalSuiteRunApi.Command command,
        IDocumentSession session,
        EvalRunCancellation cancellation
    )
    {
        var suite = (await session.LoadAsync<EvalSuiteRunDocument>(command.SuiteRunId))!;
        suite.CancelRequested = true;
        session.Store(suite);
        cancellation.Cancel(suite.Id);
        await session.SaveChangesAsync();

        return new CancelEvalSuiteRunApi.Response
        {
            SuiteRunId = suite.Id,
            Status = suite.Status,
            CancelRequested = suite.CancelRequested,
        };
    }
}
