extern alias Skills;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.Ai;
using Bifrost.Skills.Contracts;
using Shouldly;

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
    public async Task run_eval_records_transcript_spend_and_unsettled_checks()
    {
        var client = _factory.CreateClient();
        var id = await SeedCapabilityWithSkill(client);

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var eval = detail.Evals[0];

        var response = await PostJson<RunCapabilityEvalApi.Response>(
            client,
            "/run-capability-eval",
            new { id, evalId = eval.Id, skillVersionId = (Guid?)null }
        );
        response.ShouldNotBeNull();
        response.Run.IsEval.ShouldBeTrue();
        response.Run.Status.ShouldBe(EvalCaseRunStatuses.Completed);
        response.Run.Outcome.ShouldBe(EvalOutcomeStatuses.Unsettled);
        response.Run.Transcript.Count.ShouldBe(3);
        response.Run.Transcript[2].Role.ShouldBe("assistant");
        response.Run.Transcript[2].Text.ShouldBe("fake eval answer");
        response.Run.Spend.ShouldNotBeNull();
        response.Run.Spend!.Model.ShouldBe("test-model");
        response.Run.Spend.TotalTokens.ShouldBe(18);
        response.Run.Spend.Cost.ShouldBe(0.02);
        response.Run.Checks.Count.ShouldBe(eval.Checks.Count);
        response.Run.Checks.ShouldAllBe(c => c.Status == EvalCheckVerdictStatuses.Unsettled);

        var outcomes = await Query<GetCapabilityEvalOutcomesApi.Response>(
            client,
            $"/get-capability-eval-outcomes/{id}"
        );
        outcomes.ShouldNotBeNull();
        outcomes.Evals.Single(e => e.EvalId == eval.Id).Status.ShouldBe(EvalOutcomeStatuses.Unsettled);
        outcomes.Suite.Unsettled.ShouldBeGreaterThanOrEqualTo(1);
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
        suite.Cases.Count.ShouldBe(3);
        suite.Cases.Count(c => c.Status == EvalCaseRunStatuses.Completed).ShouldBe(1);
        suite
            .Cases.Count(c => c.Status == EvalCaseRunStatuses.NeverCompleted)
            .ShouldBe(2);
        suite.Cases.Where(c => c.Status == EvalCaseRunStatuses.NeverCompleted)
            .ShouldAllBe(c => c.Outcome == null);

        var outcomes = await Query<GetCapabilityEvalOutcomesApi.Response>(
            client,
            $"/get-capability-eval-outcomes/{id}"
        );
        outcomes.ShouldNotBeNull();
        outcomes.Suite.NeverCompleted.ShouldBe(2);
        outcomes.Suite.Failed.ShouldBe(0);
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
}
