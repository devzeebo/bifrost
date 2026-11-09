using Bifrost.Capabilities.Evals;
using Bifrost.Skills.Contracts;
using Marten;
using Marten.Patching;

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
    public static async Task<(
        CancelEvalSuiteRunApi.Response Response,
        ProcessEvalSuite Next
    )> Handle(
        CancelEvalSuiteRunApi.Command command,
        IDocumentSession session,
        EvalRunCancellation cancellation
    )
    {
        var suite = (await session.LoadAsync<EvalSuiteRunDocument>(command.SuiteRunId))!;
        if (suite.CompletedAt is not null || suite.Status != EvalSuiteRunStatuses.Running)
        {
            return (
                new CancelEvalSuiteRunApi.Response
                {
                    SuiteRunId = suite.Id,
                    Status = suite.Status,
                    CancelRequested = suite.CancelRequested,
                },
                new ProcessEvalSuite { SuiteRunId = suite.Id }
            );
        }

        // Patch only the cancel flag so a concurrent processor completion cannot be
        // overwritten by a stale whole-document Store of this suite.
        session.Patch<EvalSuiteRunDocument>(suite.Id).Set(x => x.CancelRequested, true);
        cancellation.Cancel(suite.Id);
        await session.SaveChangesAsync();

        return (
            new CancelEvalSuiteRunApi.Response
            {
                SuiteRunId = suite.Id,
                Status = suite.Status,
                CancelRequested = true,
            },
            new ProcessEvalSuite { SuiteRunId = suite.Id }
        );
    }
}
