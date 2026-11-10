extern alias Skills;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.Ai;
using Bifrost.Skills.Contracts;
using Marten;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Skills::Bifrost.Capabilities.Evals;

namespace Bifrost.Tests.Api;

[Collection("skills")]
public class SkillsChatTests
{
    readonly SkillsApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public SkillsChatTests(SkillsApiFactory factory)
    {
        _factory = factory;
        _factory.ModelClient.Handler = null;
    }

    [Fact]
    public async Task post_message_offers_proposal_and_dismiss_leaves_capability_unchanged()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Chat dismiss ask");

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "reword ask: A clearer ask for the work." }
        );
        posted.ShouldNotBeNull();
        posted.Proposal.ShouldNotBeNull();
        posted.Proposal!.Effects.ShouldContain(e => e.Kind == "AmendAsk");
        posted.PendingProposals.Count.ShouldBe(1);

        var dismissed = await PostJson<DismissCapabilityProposalApi.Response>(
            client,
            "/dismiss-capability-proposal",
            new { id, proposalId = posted.Proposal.Id }
        );
        dismissed.ShouldNotBeNull();
        dismissed.PendingProposals.ShouldBeEmpty();

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        detail.Ask.ShouldBe("Chat dismiss ask");
    }

    [Fact]
    public async Task apply_multi_layer_bundle_records_capability_and_skill_versions()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Original ask for bundle");

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "bundle: Bundled ask for the capability." }
        );
        posted.ShouldNotBeNull();
        posted.Proposal.ShouldNotBeNull();

        var applied = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = posted.Proposal!.Id }
        );
        applied.ShouldNotBeNull();
        applied.Outcome.ShouldBe("Applied");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        detail.Ask.ShouldBe("Bundled ask for the capability.");
        detail.Criteria.Count.ShouldBe(1);
        detail.Evals.Count.ShouldBe(1);
        detail.Evals[0].Prompt.ShouldNotBeNullOrWhiteSpace();
        detail.Evals[0].Checks.Count.ShouldBe(1);
        detail.Evals[0].Checks[0].Kind.ShouldBe(CheckKinds.Script);
        var seededScript = detail.Evals[0].Checks[0].Script.ShouldNotBeNull();
        seededScript.ShouldContain("export default function check");
        detail.SkillMarkdown.ShouldContain("Bundled ask");
        detail.HasUnsavedCapabilityDraft.ShouldBeFalse();
        detail.HasUnsavedSkillDraft.ShouldBeFalse();
        detail.HasPublishedSkill.ShouldBeFalse();

        var capabilityVersions = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        capabilityVersions.ShouldNotBeNull();
        capabilityVersions.Items.Count.ShouldBe(2);

        var skillVersions = await Query<ListSkillVersionsApi.Response>(
            client,
            $"/list-skill-versions/{id}"
        );
        skillVersions.ShouldNotBeNull();
        skillVersions.Items.Count.ShouldBe(1);

        var chat = await Query<GetCapabilityChatApi.Response>(
            client,
            $"/get-capability-chat/{id}"
        );
        chat.ShouldNotBeNull();
        chat.Messages.ShouldContain(m => m.Text.Contains("Applied proposal"));
        chat.PendingProposals.ShouldBeEmpty();
    }

    [Fact]
    public async Task sharpen_keeps_criterion_identity_across_versions()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Sharpen ask");

        var added = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "add criterion: First wording of the criterion" }
        );
        added.ShouldNotBeNull();
        var addedApply = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = added.Proposal!.Id }
        );
        addedApply.ShouldNotBeNull();
        addedApply.Outcome.ShouldBe("Applied");

        var before = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        before.ShouldNotBeNull();
        before.Criteria.Count.ShouldBe(1);
        var criterionId = before.Criteria[0].Id;
        var versionBefore = before.CurrentCapabilityVersionId!.Value;

        var sharpened = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = $"sharpen {criterionId}: Sharpened wording of the criterion" }
        );
        sharpened.ShouldNotBeNull();
        var sharpenedApply = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = sharpened.Proposal!.Id }
        );
        sharpenedApply.ShouldNotBeNull();
        sharpenedApply.Outcome.ShouldBe("Applied");

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.Criteria.Count.ShouldBe(1);
        after.Criteria[0].Id.ShouldBe(criterionId);
        after.Criteria[0].Statement.ShouldBe("Sharpened wording of the criterion");

        var compare = await Query<CompareCapabilityVersionsApi.Response>(
            client,
            $"/compare-capability-versions/{id}/{versionBefore}/{after.CurrentCapabilityVersionId}"
        );
        compare.ShouldNotBeNull();
        compare.Left.Snapshot.Criteria.ShouldHaveSingleItem().Id.ShouldBe(criterionId);
        compare.Right.Snapshot.Criteria.ShouldHaveSingleItem().Id.ShouldBe(criterionId);
        compare.Right.Snapshot.Criteria[0].Statement.ShouldBe(
            "Sharpened wording of the criterion"
        );
    }

    [Fact]
    public async Task sharpen_rederives_script_checks_keeping_check_identity()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Sharpen rederive ask");

        var before = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        before.ShouldNotBeNull();
        var criterionId = before.Criteria[0].Id;
        var checkId = before.Evals[0].Checks[0].Id;
        var priorScript = before.Evals[0].Checks[0].Script.ShouldNotBeNull();

        var sharpened = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = $"sharpen {criterionId}: Sharpened criterion for checks" }
        );
        sharpened.ShouldNotBeNull();
        (
            await PostJson<ApplyCapabilityProposalApi.Response>(
                client,
                "/apply-capability-proposal",
                new { id, proposalId = sharpened.Proposal!.Id }
            )
        )
            .ShouldNotBeNull()
            .Outcome.ShouldBe("Applied");

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.Criteria[0].Statement.ShouldBe("Sharpened criterion for checks");
        after.Evals[0].Checks[0].Id.ShouldBe(checkId);
        after.Evals[0].Checks[0].Kind.ShouldBe(CheckKinds.Script);
        after.Evals[0].Checks[0].Statement.ShouldContain("Sharpened criterion for checks");
        var script = after.Evals[0].Checks[0].Script.ShouldNotBeNull();
        script.ShouldContain("export default function check");
        script.ShouldNotBe(priorScript);
    }

    [Fact]
    public async Task concurrent_ask_amend_marks_proposal_stale_and_reread_reoffers()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Stale race ask");

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "reword ask: Proposal ask that becomes stale." }
        );
        posted.ShouldNotBeNull();
        var proposalId = posted.Proposal!.Id;

        (
            await Post(client, "/amend-capability-ask", new { id, ask = "Hand-edited ask meanwhile" })
        ).StatusCode.ShouldBe(HttpStatusCode.OK);

        var applied = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId }
        );
        applied.ShouldNotBeNull();
        applied.Outcome.ShouldBe("Reoffered");
        applied.Proposal.ShouldNotBeNull();
        applied.Proposal!.Id.ShouldNotBe(proposalId);

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        detail.Ask.ShouldBe("Hand-edited ask meanwhile");
    }

    [Fact]
    public async Task applying_one_pending_proposal_stales_the_other()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Two proposals ask");

        var first = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "reword ask: First pending ask." }
        );
        var second = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "reword ask: Second pending ask." }
        );
        first.ShouldNotBeNull();
        second.ShouldNotBeNull();

        var applied = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = first.Proposal!.Id }
        );
        applied.ShouldNotBeNull();
        applied.Outcome.ShouldBe("Applied");
        applied.PendingProposals.Count.ShouldBe(1);
        applied.PendingProposals[0].Id.ShouldBe(second.Proposal!.Id);
        applied.PendingProposals[0].IsStale.ShouldBeTrue();
    }

    [Fact]
    public async Task skill_only_apply_versions_skill_without_publishing()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Skill only ask");

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "replace skill: # Skill\n\nDraft from chat only." }
        );
        posted.ShouldNotBeNull();

        var applied = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = posted.Proposal!.Id }
        );
        applied.ShouldNotBeNull();
        applied.Outcome.ShouldBe("Applied");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        detail.SkillMarkdown.ShouldContain("Draft from chat only");
        detail.HasPublishedSkill.ShouldBeFalse();
        detail.CurrentSkillVersionId.ShouldNotBeNull();
    }

    [Fact]
    public async Task conversation_survives_reload()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Persist chat ask");

        await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "hello there" }
        );

        var chat = await Query<GetCapabilityChatApi.Response>(
            client,
            $"/get-capability-chat/{id}"
        );
        chat.ShouldNotBeNull();
        chat.Messages.Count.ShouldBeGreaterThanOrEqualTo(2);
        chat.Messages.ShouldContain(m => m.Role == "user" && m.Text == "hello there");
        chat.Messages.ShouldContain(m => m.Role == "assistant");
    }

    [Fact]
    public async Task amend_eval_keeps_identity_and_records_version()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Amend eval ask");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var evalId = detail.Evals[0].Id;
        var versionsBefore = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );

        // Keep the criterion wording in the scenario so ask/criterion stay put; skill still drafts.
        var scenario = $"{detail.Criteria[0].Statement} — Amended scenario statement";
        var amended = await PostJson<AmendCapabilityEvalApi.Response>(
            client,
            "/amend-capability-eval",
            new
            {
                id,
                evalId,
                scenario,
                prompt = "Amended prompt",
                context = "Amended context",
                checks = new[]
                {
                    new
                    {
                        id = detail.Evals[0].Checks[0].Id,
                        kind = detail.Evals[0].Checks[0].Kind,
                        statement = detail.Evals[0].Checks[0].Statement,
                    },
                },
            }
        );
        amended.ShouldNotBeNull();
        amended.Outcome.ShouldBe("Proposed");
        amended.Proposal.ShouldNotBeNull();
        amended.Proposal!.Effects.ShouldContain(e => e.Kind == "ReplaceSkill");
        (
            await PostJson<ApplyCapabilityProposalApi.Response>(
                client,
                "/apply-capability-proposal",
                new { id, proposalId = amended.Proposal.Id }
            )
        ).ShouldNotBeNull();

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.Evals.Count.ShouldBe(1);
        after.Evals[0].Id.ShouldBe(evalId);
        after.Evals[0].Scenario.ShouldBe(scenario);
        after.Evals[0].Prompt.ShouldBe("Amended prompt");
        after.Evals[0].Context.ShouldBe("Amended context");
        after.Evals[0].Checks[0].Id.ShouldBe(detail.Evals[0].Checks[0].Id);
        after.Evals[0].Checks[0].Kind.ShouldBe(CheckKinds.Script);
        after.Evals[0].Checks[0].Statement.ShouldContain(detail.Criteria[0].Statement);
        var amendedScript = after.Evals[0].Checks[0].Script.ShouldNotBeNull();
        amendedScript.ShouldContain("export default function check");

        var versionsAfter = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        versionsAfter.ShouldNotBeNull();
        versionsAfter.Items.Count.ShouldBe(versionsBefore!.Items.Count + 1);
    }

    [Fact]
    public async Task duplicate_eval_copies_with_new_ids()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Duplicate eval ask");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var source = detail.Evals[0];
        var newEvalId = Guid.NewGuid();

        (
            await Post(
                client,
                "/duplicate-capability-eval",
                new
                {
                    id,
                    sourceEvalId = source.Id,
                    newEvalId,
                }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.Evals.Count.ShouldBe(2);
        var copy = after.Evals.Single(e => e.Id == newEvalId);
        copy.CriterionId.ShouldBe(source.CriterionId);
        copy.Scenario.ShouldBe(source.Scenario);
        copy.Prompt.ShouldBe(source.Prompt);
        copy.Checks.Count.ShouldBe(source.Checks.Count);
        copy.Checks[0].Id.ShouldNotBe(source.Checks[0].Id);
        copy.Checks[0].Statement.ShouldBe(source.Checks[0].Statement);
    }

    [Fact]
    public async Task retire_last_eval_reports_uncovered_criterion()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Retire eval ask");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var evalId = detail.Evals[0].Id;
        var criterionId = detail.Evals[0].CriterionId;

        var retired = await PostJson<RetireCapabilityEvalApi.Response>(
            client,
            "/retire-capability-eval",
            new { id, evalId }
        );
        retired.ShouldNotBeNull();
        retired.LeftCriterionUncovered.ShouldBeTrue();
        retired.UncoveredCriterionId.ShouldBe(criterionId);
        retired.Note.ShouldNotBeNullOrWhiteSpace();

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.Evals.ShouldBeEmpty();
        after.Criteria.Count.ShouldBe(1);
    }

    [Fact]
    public async Task retire_last_eval_via_chat_retires_criterion_too()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Retire via chat ask");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var evalId = detail.Evals[0].Id;

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = $"retire eval {evalId}" }
        );
        posted.ShouldNotBeNull();
        posted.Proposal.ShouldNotBeNull();
        posted.Proposal!.Effects.ShouldContain(e => e.Kind == "RetireEval");
        posted.Proposal.Effects.ShouldContain(e => e.Kind == "RetireCriterion");
        posted.Proposal.Effects.ShouldContain(e => e.Kind == "ReplaceSkill");

        var applied = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = posted.Proposal.Id }
        );
        applied.ShouldNotBeNull();
        applied.Outcome.ShouldBe("Applied");
        applied.Note!.ShouldNotContain("uncovered");

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.Evals.ShouldBeEmpty();
        after.Criteria.ShouldBeEmpty();
    }

    [Fact]
    public async Task retire_criterion_does_not_warn_about_removed_criterion()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Retire criterion ask");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var criterionId = detail.Criteria[0].Id;

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = $"retire {criterionId}" }
        );
        posted.ShouldNotBeNull();
        posted.Proposal.ShouldNotBeNull();

        var applied = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = posted.Proposal!.Id }
        );
        applied.ShouldNotBeNull();
        applied.Outcome.ShouldBe("Applied");
        applied.Note!.ShouldNotContain("uncovered");
    }

    [Fact]
    public async Task derive_skill_run_less_records_no_suite_run_and_states_first_run_failures()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEvalWithoutSkill(client, "Derive run-less ask");

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "derive skill" }
        );
        posted.ShouldNotBeNull();
        posted.Proposal.ShouldNotBeNull();
        posted.Proposal!.Effects.ShouldContain(e => e.Kind == "ReplaceSkill");
        posted.Proposal.Summary.ShouldContain("first run");
        posted.Proposal.BasisSuiteRunId.ShouldBeNull();

        var applied = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = posted.Proposal.Id }
        );
        applied.ShouldNotBeNull();
        applied.Outcome.ShouldBe("Applied");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        detail.SkillMarkdown.ShouldContain("Derive run-less ask");
        detail.DerivedAgainstSuiteRunId.ShouldBeNull();
        detail.IsSkillStale.ShouldBeFalse();

        var versions = await Query<ListSkillVersionsApi.Response>(
            client,
            $"/list-skill-versions/{id}"
        );
        versions.ShouldNotBeNull();
        versions.Items.Count.ShouldBe(1);
        versions.Items[0].DerivedAgainstSuiteRunId.ShouldBeNull();
    }

    [Fact]
    public async Task rederive_skill_adds_version_of_same_skill_history()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Rederive identity ask");
        var before = await Query<ListSkillVersionsApi.Response>(
            client,
            $"/list-skill-versions/{id}"
        );
        before.ShouldNotBeNull();
        before.Items.Count.ShouldBe(1);

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "re-derive skill" }
        );
        posted.ShouldNotBeNull();
        posted.Proposal.ShouldNotBeNull();

        (
            await PostJson<ApplyCapabilityProposalApi.Response>(
                client,
                "/apply-capability-proposal",
                new { id, proposalId = posted.Proposal!.Id }
            )
        ).ShouldNotBeNull();

        var after = await Query<ListSkillVersionsApi.Response>(
            client,
            $"/list-skill-versions/{id}"
        );
        after.ShouldNotBeNull();
        after.Items.Count.ShouldBe(2);
        after.Items[0].DerivedAgainstCapabilityVersionId.ShouldBe(
            after.Items[1].DerivedAgainstCapabilityVersionId
        );
    }

    [Fact]
    public async Task derive_skill_with_completed_suite_names_run_and_live_summary_updates()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Derive suite basis ask");
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();

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
                    },
                }
            );

        var suite = await PostJson<RunCapabilitySuiteApi.Response>(
            client,
            "/run-capability-suite",
            new { id }
        );
        suite.ShouldNotBeNull();
        await WaitForSuite(client, suite.SuiteRunId);

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "derive skill" }
        );
        posted.ShouldNotBeNull();
        posted.Proposal.ShouldNotBeNull();
        posted.Proposal!.BasisSuiteRunId.ShouldBe(suite.SuiteRunId);
        posted.Proposal.Summary.ShouldContain(suite.SuiteRunId.ToString("N"));

        await using (
            var session = _factory.Services.GetRequiredService<Marten.IDocumentStore>().LightweightSession()
        )
        {
            var cases = await session
                .Query<EvalCaseRunDocument>()
                .Where(r => r.SuiteRunId == suite.SuiteRunId)
                .ToListAsync();
            cases.Count.ShouldBeGreaterThan(0);
            foreach (var run in cases)
            {
                run.Outcome = EvalOutcomeStatuses.Failed;
                run.Checks =
                [
                    .. run.Checks.Select(c =>
                        c with
                        {
                            Status = EvalCheckVerdictStatuses.Failed,
                            Reason = "Flipped for live summary test.",
                        }
                    ),
                ];
                session.Store(run);
            }

            await session.SaveChangesAsync();
        }

        var chat = await Query<GetCapabilityChatApi.Response>(
            client,
            $"/get-capability-chat/{id}"
        );
        chat.ShouldNotBeNull();
        var pending = chat.PendingProposals.Single(p => p.Id == posted.Proposal.Id);
        pending.Summary.ShouldContain("failing");
        pending.BasisSuiteRunId.ShouldBe(suite.SuiteRunId);

        var applied = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = posted.Proposal.Id }
        );
        applied.ShouldNotBeNull();
        applied.Outcome.ShouldBe("Applied");
        applied.Note!.ShouldContain("failing");

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.DerivedAgainstSuiteRunId.ShouldBe(suite.SuiteRunId);
    }

    static async Task<Guid> SeedCriterionAndEvalWithoutSkill(HttpClient client, string ask)
    {
        var id = await CreateCapability(client, ask);
        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = $"add criterion: {ask}" }
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

    static async Task WaitForSuite(HttpClient client, Guid suiteRunId)
    {
        for (var i = 0; i < 40; i++)
        {
            var suite = await Query<GetEvalSuiteRunApi.Response>(
                client,
                $"/get-eval-suite-run/{suiteRunId}"
            );
            if (
                suite is not null
                && suite.Status
                    is EvalSuiteRunStatuses.Completed
                        or EvalSuiteRunStatuses.Canceled
            )
            {
                return;
            }

            await Task.Delay(100);
        }

        throw new TimeoutException($"Suite {suiteRunId} did not complete.");
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
                    name = $"Chat {id:N}"[..20],
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
