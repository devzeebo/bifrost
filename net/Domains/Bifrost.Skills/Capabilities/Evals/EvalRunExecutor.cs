using System.Text;
using System.Text.Json;
using Bifrost.Ai;
using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;
using Microsoft.Extensions.Options;

// CommandValidationException lives in Bifrost

namespace Bifrost.Capabilities.Evals;

public sealed class EvalRunExecutor(
    IModelClient modelClient,
    IOptionsMonitor<AiClientOptions> aiOptions,
    IScriptCheckRunner scriptCheckRunner
)
{
    public async Task<(string Markdown, Guid? SkillVersionId)> ResolveSkill(
        IQuerySession session,
        CapabilityView.Model capability,
        Guid? skillVersionId
    )
    {
        if (skillVersionId is { } versionId)
        {
            var version = await session.LoadAsync<SkillVersionView.Model>(versionId);
            if (version is null || version.CapabilityId != capability.Id)
            {
                throw new CommandValidationException($"Skill version {versionId} not found.");
            }

            if (string.IsNullOrWhiteSpace(version.Snapshot.Markdown))
            {
                throw new CommandValidationException("Skill version markdown is empty.");
            }

            return (version.Snapshot.Markdown, versionId);
        }

        if (string.IsNullOrWhiteSpace(capability.SkillMarkdown))
        {
            throw new CommandValidationException(
                "Skill draft markdown is empty. Save a derived skill before running evals."
            );
        }

        return (capability.SkillMarkdown, null);
    }

    public async Task<EvalCaseRunDocument> ExecuteCase(
        IDocumentSession session,
        CapabilityView.Model capability,
        EvalSnapshot eval,
        string skillMarkdown,
        Guid? skillVersionId,
        Guid? suiteRunId,
        CancellationToken ct
    )
    {
        var run = new EvalCaseRunDocument
        {
            Id = Guid.NewGuid(),
            CapabilityId = capability.Id,
            EvalId = eval.Id,
            CriterionId = eval.CriterionId,
            SuiteRunId = suiteRunId,
            SkillVersionId = skillVersionId,
            CapabilityVersionId = capability.CurrentCapabilityVersionId,
            SkillMarkdown = skillMarkdown,
            IsEval = true,
            Status = EvalCaseRunStatuses.Running,
            StartedAt = DateTimeOffset.UtcNow,
        };
        session.Store(run);
        await session.SaveChangesAsync(ct);

        try
        {
            var userText = BuildUserInput(eval);
            using var inputDoc = JsonDocument.Parse(JsonSerializer.Serialize(userText));
            var input = new[] { inputDoc.RootElement.Clone() };
            var response = await modelClient.CreateResponse(
                new ModelRequest
                {
                    SessionId = run.Id.ToString("N"),
                    Instructions = skillMarkdown,
                    Input = input,
                    Tools = [],
                },
                ct
            );

            run.Transcript =
            [
                new TranscriptLine { Role = "system", Text = skillMarkdown },
                new TranscriptLine { Role = "user", Text = userText },
                new TranscriptLine { Role = "assistant", Text = response.OutputText },
            ];
            run.Spend = ToSpend(response.Usage);
            run.Checks = await BuildCheckVerdicts(eval, run.Transcript, ct);
            run.Outcome = EvalOutcomeRollup.DeriveCaseOutcome(run.Checks);
            run.Status = EvalCaseRunStatuses.Completed;
            run.CompletedAt = DateTimeOffset.UtcNow;
            session.Store(run);
            StoreLatest(session, run);
            await session.SaveChangesAsync(ct);
            return run;
        }
        catch (OperationCanceledException)
        {
            MarkNeverCompleted(session, run);
            await session.SaveChangesAsync(CancellationToken.None);
            throw;
        }
    }

    public void MarkNeverCompleted(IDocumentSession session, EvalCaseRunDocument run)
    {
        run.Status = EvalCaseRunStatuses.NeverCompleted;
        run.Outcome = null;
        run.CompletedAt = DateTimeOffset.UtcNow;
        session.Store(run);
        StoreLatest(session, run);
    }

    public static void StoreLatest(IDocumentSession session, EvalCaseRunDocument run)
    {
        session.Store(
            new EvalLatestByEvalDocument
            {
                Id = EvalLatestByEvalDocument.Key(run.CapabilityId, run.EvalId),
                CapabilityId = run.CapabilityId,
                EvalId = run.EvalId,
                CriterionId = run.CriterionId,
                CaseRunId = run.Id,
                Status = EvalOutcomeRollup.LatestStatus(run),
                CapabilityVersionId = run.CapabilityVersionId,
                SkillVersionId = run.SkillVersionId,
                RecordedAt = run.CompletedAt ?? run.StartedAt,
            }
        );
    }

    async Task<List<EvalCheckVerdict>> BuildCheckVerdicts(
        EvalSnapshot eval,
        IReadOnlyList<TranscriptLine> transcript,
        CancellationToken ct
    )
    {
        var transcriptText = FormatTranscript(transcript);
        var verdicts = new List<EvalCheckVerdict>(eval.Checks.Count);
        foreach (var check in eval.Checks)
        {
            if (check.Kind == CheckKinds.HumanReview)
            {
                verdicts.Add(
                    new EvalCheckVerdict
                    {
                        CheckId = check.Id,
                        Kind = check.Kind,
                        Status = EvalCheckVerdictStatuses.Unsettled,
                        Reason = "Awaiting human review",
                    }
                );
                continue;
            }

            var result = await scriptCheckRunner.Run(
                new ScriptCheckRequest
                {
                    CheckId = check.Id,
                    Statement = check.Statement,
                    Script = check.Script,
                    Transcript = transcriptText,
                    Context = eval.Context,
                },
                ct
            );
            verdicts.Add(
                new EvalCheckVerdict
                {
                    CheckId = check.Id,
                    Kind = string.IsNullOrWhiteSpace(check.Kind) ? CheckKinds.Script : check.Kind,
                    Status = result.Status,
                    Reason = result.Reason,
                }
            );
        }

        return verdicts;
    }

    EvalSpend ToSpend(LineUsage? usage)
    {
        var model = aiOptions.CurrentValue.Model;
        return new EvalSpend
        {
            Model = model,
            InputTokens = usage?.InputTokens ?? 0,
            OutputTokens = usage?.OutputTokens ?? 0,
            TotalTokens = usage?.TotalTokens ?? 0,
            Cost = usage?.Cost,
        };
    }

    static string BuildUserInput(EvalSnapshot eval)
    {
        var sb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(eval.Context))
        {
            sb.AppendLine("Context:");
            sb.AppendLine(eval.Context.Trim());
            sb.AppendLine();
        }

        sb.AppendLine("Prompt:");
        sb.Append(eval.Prompt.Trim());
        return sb.ToString().Trim();
    }

    static string FormatTranscript(IReadOnlyList<TranscriptLine> transcript)
    {
        var sb = new StringBuilder();
        foreach (var line in transcript)
        {
            sb.Append(line.Role);
            sb.Append(": ");
            sb.AppendLine(line.Text);
        }

        return sb.ToString().Trim();
    }
}
