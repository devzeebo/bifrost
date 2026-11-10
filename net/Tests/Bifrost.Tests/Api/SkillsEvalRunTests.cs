extern alias Skills;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.Ai;
using Bifrost.Skills.Contracts;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Shouldly;
using Skills::Bifrost.Capabilities.Evals;

namespace Bifrost.Tests.Api;

[Collection("skills")]
public class SkillsEvalRunTests
{
    readonly SkillsApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public SkillsEvalRunTests(SkillsApiFactory factory)
    {
        _factory = factory;
        _factory.ModelClient.Handler = null;
    }

    [Fact]
    public async Task run_eval_records_transcript_spend_and_script_verdicts()
    {
        var client = _factory.CreateClient();
        var id = await SeedCapabilityWithSkill(client);

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var eval = detail.Evals[0];

        // Default authored script looks for the criterion wording in the transcript.
        _factory.ModelClient.Handler = (_, _) =>
            Task.FromResult(
                new ModelResponse
                {
                    Status = "completed",
                    OutputText = "capability does what the ask requires",
                    Output = [],
                    Usage = new LineUsage
                    {
                        InputTokens = 10,
                        OutputTokens = 8,
                        TotalTokens = 18,
                        Cost = 0.02,
                    },
                }
            );

        var response = await PostJson<RunCapabilityEvalApi.Response>(
            client,
            "/run-capability-eval",
            new { id, evalId = eval.Id, skillVersionId = (Guid?)null }
        );
        response.ShouldNotBeNull();
        response.Run.IsEval.ShouldBeTrue();
        response.Run.Status.ShouldBe(EvalCaseRunStatuses.Completed);
        response.Run.Outcome.ShouldBe(EvalOutcomeStatuses.Passed);
        response.Run.Transcript.Count.ShouldBe(3);
        response.Run.Transcript[2].Role.ShouldBe("assistant");
        response.Run.Transcript[2].Text.ShouldBe("capability does what the ask requires");
        response.Run.Spend.ShouldNotBeNull();
        response.Run.Spend!.Model.ShouldBe("test-model");
        response.Run.Spend.TotalTokens.ShouldBe(18);
        response.Run.Spend.Cost.ShouldBe(0.02);
        response.Run.Checks.Count.ShouldBe(eval.Checks.Count);
        response.Run.Checks.ShouldAllBe(c => c.Status == EvalCheckVerdictStatuses.Passed);
        response.Run.Checks.ShouldAllBe(c => !string.IsNullOrWhiteSpace(c.Statement));
        response.Run.Checks.ShouldAllBe(c => !string.IsNullOrWhiteSpace(c.Reason));

        var outcomes = await Query<GetCapabilityEvalOutcomesApi.Response>(
            client,
            $"/get-capability-eval-outcomes/{id}"
        );
        outcomes.ShouldNotBeNull();
        outcomes.Evals.Single(e => e.EvalId == eval.Id).Status.ShouldBe(EvalOutcomeStatuses.Passed);
        outcomes.Suite.Passed.ShouldBeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task failing_script_check_settles_case_failed()
    {
        var client = _factory.CreateClient();
        var id = await SeedCapabilityWithSkill(client);
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        var eval = detail!.Evals[0];

        _factory.ModelClient.Handler = (_, _) =>
            Task.FromResult(
                new ModelResponse
                {
                    Status = "completed",
                    OutputText = "unrelated answer with no criterion wording",
                    Output = [],
                    Usage = new LineUsage
                    {
                        InputTokens = 2,
                        OutputTokens = 2,
                        TotalTokens = 4,
                        Cost = 0.01,
                    },
                }
            );

        var response = await PostJson<RunCapabilityEvalApi.Response>(
            client,
            "/run-capability-eval",
            new { id, evalId = eval.Id }
        );
        response.ShouldNotBeNull();
        response.Run.Status.ShouldBe(EvalCaseRunStatuses.Completed);
        response.Run.Outcome.ShouldBe(EvalOutcomeStatuses.Failed);
        response.Run.Checks.ShouldAllBe(c => c.Status == EvalCheckVerdictStatuses.Failed);

        var outcomes = await Query<GetCapabilityEvalOutcomesApi.Response>(
            client,
            $"/get-capability-eval-outcomes/{id}"
        );
        outcomes.ShouldNotBeNull();
        outcomes.Evals.Single(e => e.EvalId == eval.Id).Status.ShouldBe(EvalOutcomeStatuses.Failed);
        outcomes.Suite.Failed.ShouldBeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task broken_check_does_not_crash_run_and_siblings_still_execute()
    {
        var client = _factory
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureTestServices(services =>
                {
                    services.RemoveAll<IScriptCheckRunner>();
                    services.AddSingleton<IScriptCheckRunner>(new SequencingScriptCheckRunner());
                });
            })
            .CreateClient();

        var id = await SeedCapabilityWithSkill(client);
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var eval = detail.Evals[0];

        // Plant three script checks with stable ids via amend (same scenario → keeps/overrides kinds).
        var checkError = Guid.NewGuid();
        var checkFail = Guid.NewGuid();
        var checkPass = Guid.NewGuid();
        (
            await Post(
                client,
                "/amend-capability-eval",
                new
                {
                    id,
                    evalId = eval.Id,
                    scenario = eval.Scenario,
                    prompt = eval.Prompt,
                    context = eval.Context,
                    checks = new object[]
                    {
                        new
                        {
                            id = checkError,
                            statement = eval.Checks[0].Statement,
                            kind = CheckKinds.Script,
                            script = (string?)null,
                        },
                        new
                        {
                            id = checkFail,
                            statement = eval.Checks[0].Statement,
                            kind = CheckKinds.Script,
                            script = (string?)null,
                        },
                        new
                        {
                            id = checkPass,
                            statement = eval.Checks[0].Statement,
                            kind = CheckKinds.Script,
                            script = (string?)null,
                        },
                    },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        _factory.ModelClient.Handler = (_, _) =>
            Task.FromResult(
                new ModelResponse
                {
                    Status = "completed",
                    OutputText = "answer",
                    Output = [],
                    Usage = new LineUsage
                    {
                        InputTokens = 1,
                        OutputTokens = 1,
                        TotalTokens = 2,
                        Cost = 0.01,
                    },
                }
            );

        var response = await PostJson<RunCapabilityEvalApi.Response>(
            client,
            "/run-capability-eval",
            new { id, evalId = eval.Id }
        );
        response.ShouldNotBeNull();
        response.Run.Status.ShouldBe(EvalCaseRunStatuses.Completed);
        response.Run.Outcome.ShouldBe(EvalOutcomeStatuses.Failed);
        response.Run.Checks.Count.ShouldBe(3);
        response.Run.Checks[0].Status.ShouldBe(EvalCheckVerdictStatuses.Failed);
        response.Run.Checks[0].Reason.ShouldContain("boom");
        response.Run.Checks[1].Status.ShouldBe(EvalCheckVerdictStatuses.Failed);
        response.Run.Checks[1].Reason.ShouldContain("genuine");
        response.Run.Checks[2].Status.ShouldBe(EvalCheckVerdictStatuses.Passed);
        response.Run.Checks.ShouldAllBe(c => !string.IsNullOrWhiteSpace(c.Statement));
    }

    [Fact]
    public async Task human_review_check_leaves_case_unsettled()
    {
        var client = _factory.CreateClient();
        var id = await SeedCapabilityWithSkill(client);
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        var eval = detail!.Evals[0];
        var check = eval.Checks[0];

        (
            await Post(
                client,
                "/amend-capability-eval",
                new
                {
                    id,
                    evalId = eval.Id,
                    scenario = eval.Scenario,
                    prompt = eval.Prompt,
                    context = eval.Context,
                    checks = new object[]
                    {
                        new
                        {
                            id = check.Id,
                            statement = check.Statement,
                            kind = CheckKinds.HumanReview,
                            script = (string?)null,
                        },
                    },
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        _factory.ModelClient.Handler = (_, _) =>
            Task.FromResult(
                new ModelResponse
                {
                    Status = "completed",
                    OutputText = "capability does what the ask requires",
                    Output = [],
                    Usage = new LineUsage
                    {
                        InputTokens = 1,
                        OutputTokens = 1,
                        TotalTokens = 2,
                        Cost = 0.01,
                    },
                }
            );

        var response = await PostJson<RunCapabilityEvalApi.Response>(
            client,
            "/run-capability-eval",
            new { id, evalId = eval.Id }
        );
        response.ShouldNotBeNull();
        response.Run.Outcome.ShouldBe(EvalOutcomeStatuses.Unsettled);
        response.Run.Checks.Single().Status.ShouldBe(EvalCheckVerdictStatuses.Unsettled);
    }

    [Fact]
    public async Task re_run_keeps_history_and_updates_latest()
    {
        var client = _factory.CreateClient();
        var id = await SeedCapabilityWithSkill(client);
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        var evalId = detail!.Evals[0].Id;

        var first = await PostJson<RunCapabilityEvalApi.Response>(
            client,
            "/run-capability-eval",
            new { id, evalId }
        );
        first.ShouldNotBeNull();

        _factory.ModelClient.Handler = (_, _) =>
            Task.FromResult(
                new ModelResponse
                {
                    Status = "completed",
                    OutputText = "second answer",
                    Output = [],
                    Usage = new LineUsage
                    {
                        InputTokens = 2,
                        OutputTokens = 2,
                        TotalTokens = 4,
                        Cost = 0.01,
                    },
                }
            );

        var second = await PostJson<RunCapabilityEvalApi.Response>(
            client,
            "/run-capability-eval",
            new { id, evalId }
        );
        second.ShouldNotBeNull();
        second.Run.Id.ShouldNotBe(first!.Run.Id);
        second.Run.Transcript.ShouldContain(l => l.Text == "second answer");

        var history = await Query<ListEvalCaseRunsApi.Response>(
            client,
            $"/list-eval-case-runs/{id}/{evalId}"
        );
        history.ShouldNotBeNull();
        history.Items.Count.ShouldBe(2);

        var outcomes = await Query<GetCapabilityEvalOutcomesApi.Response>(
            client,
            $"/get-capability-eval-outcomes/{id}"
        );
        outcomes.ShouldNotBeNull();
        outcomes.Evals.Single(e => e.EvalId == evalId).CaseRunId.ShouldBe(second.Run.Id);
    }

    [Fact]
    public async Task suite_cancel_marks_remaining_never_completed()
    {
        var client = _factory.CreateClient();
        var id = await SeedCapabilityWithThreeEvals(client);

        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var startedSecond = new TaskCompletionSource(
            TaskCreationOptions.RunContinuationsAsynchronously
        );
        var call = 0;
        _factory.ModelClient.Handler = async (_, ct) =>
        {
            var n = Interlocked.Increment(ref call);
            if (n == 1)
            {
                return new ModelResponse
                {
                    Status = "completed",
                    OutputText = "first",
                    Output = [],
                    Usage = new LineUsage
                    {
                        InputTokens = 1,
                        OutputTokens = 1,
                        TotalTokens = 2,
                        Cost = 0.01,
                    },
                };
            }

            startedSecond.TrySetResult();
            await gate.Task.WaitAsync(ct);
            return new ModelResponse
            {
                Status = "completed",
                OutputText = "should-not-finish",
                Output = [],
                Usage = new LineUsage
                {
                    InputTokens = 1,
                    OutputTokens = 1,
                    TotalTokens = 2,
                    Cost = 0.01,
                },
            };
        };

        var started = await PostJson<RunCapabilitySuiteApi.Response>(
            client,
            "/run-capability-suite",
            new { id }
        );
        started.ShouldNotBeNull();
        started.Status.ShouldBe(EvalSuiteRunStatuses.Running);

        await startedSecond.Task.WaitAsync(TimeSpan.FromSeconds(10));

        (
            await PostJson<CancelEvalSuiteRunApi.Response>(
                client,
                "/cancel-eval-suite-run",
                new { suiteRunId = started.SuiteRunId }
            )
        ).ShouldNotBeNull();

        gate.TrySetCanceled();

        GetEvalSuiteRunApi.Response? suite = null;
        for (var i = 0; i < 40; i++)
        {
            suite = await Query<GetEvalSuiteRunApi.Response>(
                client,
                $"/get-eval-suite-run/{started.SuiteRunId}"
            );
            if (suite?.Status is EvalSuiteRunStatuses.Canceled or EvalSuiteRunStatuses.Completed)
            {
                break;
            }

            await Task.Delay(250);
        }

        suite.ShouldNotBeNull();
        suite!.Status.ShouldBe(EvalSuiteRunStatuses.Canceled);
        suite.Cases.Count(c => c.Status == EvalCaseRunStatuses.Completed).ShouldBe(1);
        suite
            .Cases.Count(c => c.Status == EvalCaseRunStatuses.NeverCompleted)
            .ShouldBeGreaterThanOrEqualTo(2);
        suite.Cases.Where(c => c.Status == EvalCaseRunStatuses.NeverCompleted)
            .ShouldAllBe(c => c.Outcome == null);

        var outcomes = await Query<GetCapabilityEvalOutcomesApi.Response>(
            client,
            $"/get-capability-eval-outcomes/{id}"
        );
        outcomes.ShouldNotBeNull();
        // Latest-by-eval: two evals never completed; the finished case may fail its script check.
        outcomes.Suite.NeverCompleted.ShouldBe(2);
        outcomes.Criteria.Sum(c => c.NeverCompleted).ShouldBe(2);
    }

    [Fact]
    public async Task run_eval_rejects_unknown_skill_version()
    {
        var client = _factory.CreateClient();
        var id = await SeedCapabilityWithSkill(client);
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        var response = await Post(
            client,
            "/run-capability-eval",
            new
            {
                id,
                evalId = detail!.Evals[0].Id,
                skillVersionId = Guid.NewGuid(),
            }
        );
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    async Task<Guid> SeedCapabilityWithSkill(HttpClient client)
    {
        var id = await SeedCriterionAndEval(client, "Eval run ask");
        (
            await Post(
                client,
                "/save-derived-skill",
                new { id, markdown = "# Skill\n\nAnswer the eval prompt." }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        return id;
    }

    async Task<Guid> SeedCapabilityWithThreeEvals(HttpClient client)
    {
        var id = await SeedCapabilityWithSkill(client);
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var source = detail.Evals[0];
        for (var i = 0; i < 2; i++)
        {
            (
                await Post(
                    client,
                    "/duplicate-capability-eval",
                    new
                    {
                        id,
                        sourceEvalId = source.Id,
                        newEvalId = Guid.NewGuid(),
                    }
                )
            ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        }

        return id;
    }

    static async Task<Guid> SeedCriterionAndEval(HttpClient client, string ask)
    {
        var id = await CreateCapability(client, ask);
        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "bundle: " + ask }
        );
        posted.ShouldNotBeNull();
        (
            await PostJson<ApplyCapabilityProposalApi.Response>(
                client,
                "/apply-capability-proposal",
                new { id, proposalId = posted!.Proposal!.Id }
            )
        ).ShouldNotBeNull();
        return id;
    }

    static async Task<Guid> CreateCapability(HttpClient client, string ask)
    {
        var id = Guid.NewGuid();
        (
            await Post(
                client,
                "/create-capability",
                new
                {
                    id,
                    name = $"Eval {id:N}"[..20],
                    ask,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        return id;
    }

    static async Task<HttpResponseMessage> Post(HttpClient client, string path, object body)
    {
        var response = await client.PostAsJsonAsync(path, body);
        if (!response.IsSuccessStatusCode && response.StatusCode != HttpStatusCode.BadRequest)
        {
            var content = await response.Content.ReadAsStringAsync();
            throw new Exception($"{(int)response.StatusCode} {path}: {content}");
        }

        return response;
    }

    static async Task<T?> PostJson<T>(HttpClient client, string path, object body)
    {
        var response = await Post(client, path, body);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions);
    }

    static async Task<T?> Query<T>(HttpClient client, string path)
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), path)
        {
            Content = new StringContent("{}", Encoding.UTF8, "application/json"),
        };
        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions);
    }

    /// <summary>
    /// First call throws (caught as failed), second genuine fail, third pass — proves siblings run.
    /// </summary>
    sealed class SequencingScriptCheckRunner : IScriptCheckRunner
    {
        int _call;

        public Task<ScriptCheckResult> Run(ScriptCheckRequest request, CancellationToken ct)
        {
            var n = Interlocked.Increment(ref _call);
            if (n == 1)
            {
                throw new InvalidOperationException("boom from runner");
            }

            if (n == 2)
            {
                return Task.FromResult(
                    new ScriptCheckResult
                    {
                        Status = EvalCheckVerdictStatuses.Failed,
                        Reason = "genuine fail against transcript",
                    }
                );
            }

            return Task.FromResult(
                new ScriptCheckResult
                {
                    Status = EvalCheckVerdictStatuses.Passed,
                    Reason = $"Passed: {request.Statement}",
                }
            );
        }
    }
}
