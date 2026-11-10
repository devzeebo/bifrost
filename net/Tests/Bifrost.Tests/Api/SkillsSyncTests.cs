extern alias Skills;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.Skills.Contracts;
using Shouldly;

namespace Bifrost.Tests.Api;

[Collection("skills")]
public class SkillsSyncTests
{
    readonly SkillsApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public SkillsSyncTests(SkillsApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task hand_eval_that_detaches_from_criterion_proposes_sync_and_decline_leaves_both()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Sync detach ask");
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var evalId = detail.Evals[0].Id;
        var criterionStatement = detail.Criteria[0].Statement;
        var originalScenario = detail.Evals[0].Scenario;

        var proposed = await PostJson<AmendCapabilityEvalApi.Response>(
            client,
            "/amend-capability-eval",
            new
            {
                id,
                evalId,
                scenario = "Completely unrelated edge case with no shared wording",
                prompt = "Completely unrelated edge case with no shared wording",
                context = detail.Evals[0].Context,
            }
        );
        proposed.ShouldNotBeNull();
        proposed.Outcome.ShouldBe("Proposed");
        proposed.Proposal.ShouldNotBeNull();
        proposed.Proposal!.Effects.ShouldContain(e => e.Kind == "AmendEval");
        proposed.Proposal.Effects.ShouldContain(e => e.Kind == "SharpenCriterion");

        var dismissed = await PostJson<DismissCapabilityProposalApi.Response>(
            client,
            "/dismiss-capability-proposal",
            new { id, proposalId = proposed.Proposal.Id }
        );
        dismissed.ShouldNotBeNull();

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.Criteria[0].Statement.ShouldBe(criterionStatement);
        after.Evals[0].Scenario.ShouldBe(originalScenario);
    }

    [Fact]
    public async Task hand_eval_detach_accept_versions_once_and_marks_skill_stale()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Sync accept ask");
        var before = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        before.ShouldNotBeNull();
        before.IsSkillStale.ShouldBeFalse();
        var evalId = before.Evals[0].Id;
        var versionBefore = before.CurrentCapabilityVersionId;

        var proposed = await PostJson<AmendCapabilityEvalApi.Response>(
            client,
            "/amend-capability-eval",
            new
            {
                id,
                evalId,
                scenario = "Brand new detached scenario for the criterion",
                prompt = "Brand new detached scenario for the criterion",
                context = "",
            }
        );
        proposed.ShouldNotBeNull();
        proposed.Outcome.ShouldBe("Proposed");

        var applied = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = proposed.Proposal!.Id }
        );
        applied.ShouldNotBeNull();
        applied.Outcome.ShouldBe("Applied");

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.Evals[0].Scenario.ShouldBe("Brand new detached scenario for the criterion");
        after.Criteria[0].Statement.ShouldBe("Brand new detached scenario for the criterion");
        after.CurrentCapabilityVersionId.ShouldNotBe(versionBefore);
        after.IsSkillStale.ShouldBeTrue();
        after.SkillStaleLayers.CriteriaChanged.ShouldBeTrue();
        after.SkillStaleLayers.EvalsChanged.ShouldBeTrue();
        after.SkillMarkdown.ShouldContain("Sync accept ask");

        var versions = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        versions.ShouldNotBeNull();
        // create + bundle + sync accept
        versions.Items.Count.ShouldBe(3);
    }

    [Fact]
    public async Task hand_ask_edit_touching_criteria_proposes_one_bundle()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Original ask shared with criterion");
        var add = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "add criterion: Original ask shared with criterion" }
        );
        add.ShouldNotBeNull();
        (
            await PostJson<ApplyCapabilityProposalApi.Response>(
                client,
                "/apply-capability-proposal",
                new { id, proposalId = add.Proposal!.Id }
            )
        ).ShouldNotBeNull();

        var proposed = await PostJson<AmendCapabilityAskApi.Response>(
            client,
            "/amend-capability-ask",
            new { id, ask = "Rewritten ask shared with criterion" }
        );
        proposed.ShouldNotBeNull();
        proposed.Outcome.ShouldBe("Proposed");
        proposed.Proposal.ShouldNotBeNull();
        proposed.Proposal!.Effects.ShouldContain(e => e.Kind == "AmendAsk");
        proposed.Proposal.Effects.ShouldContain(e => e.Kind == "SharpenCriterion");
        proposed.Proposal.Effects.Count(e => e.Kind == "ReplaceSkill").ShouldBe(0);
    }

    [Fact]
    public async Task hand_ask_without_sync_applies_directly()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Lonely ask");

        var result = await PostJson<AmendCapabilityAskApi.Response>(
            client,
            "/amend-capability-ask",
            new { id, ask = "Still lonely but clearer" }
        );
        result.ShouldNotBeNull();
        result.Outcome.ShouldBe("Applied");
        result.Proposal.ShouldBeNull();

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        detail.Ask.ShouldBe("Still lonely but clearer");
    }

    [Fact]
    public async Task chat_edge_case_that_detaches_syncs_upward()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Edge case ask");
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var criterionId = detail.Criteria[0].Id;

        var posted = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new
            {
                id,
                message = $"edge case {criterionId}:Totally detached edge scenario",
            }
        );
        posted.ShouldNotBeNull();
        posted.Proposal.ShouldNotBeNull();
        posted.Proposal!.Effects.ShouldContain(e => e.Kind == "AddEval");
        posted.Proposal.Effects.ShouldContain(e => e.Kind == "SharpenCriterion");
        posted.Proposal.Effects.ShouldContain(e => e.Kind == "AmendAsk");
    }

    [Fact]
    public async Task save_skill_against_current_version_clears_stale()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Stale clear ask");
        (
            await Post(
                client,
                "/amend-capability-ask",
                new { id, ask = "Stale clear ask — amended without criterion sync" }
            )
        ).EnsureSuccessStatusCode();

        // Ask-only with criterion that doesn't share wording applies directly and stales skill.
        var mid = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        mid.ShouldNotBeNull();
        mid.IsSkillStale.ShouldBeTrue();

        (
            await Post(
                client,
                "/save-derived-skill",
                new { id, markdown = "# Skill\n\nRe-derived against current." }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var after = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        after.ShouldNotBeNull();
        after.IsSkillStale.ShouldBeFalse();
        after.SkillMarkdown.ShouldContain("Re-derived against current");
    }

    [Fact]
    public async Task hand_proposal_accept_after_intervening_chat_rereads()
    {
        var client = _factory.CreateClient();
        var id = await SeedCriterionAndEval(client, "Race sync ask");
        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var evalId = detail.Evals[0].Id;

        var hand = await PostJson<AmendCapabilityEvalApi.Response>(
            client,
            "/amend-capability-eval",
            new
            {
                id,
                evalId,
                scenario = "Hand detached scenario A",
                prompt = "Hand detached scenario A",
                context = "",
            }
        );
        hand.ShouldNotBeNull();
        hand.Outcome.ShouldBe("Proposed");

        var chat = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "reword ask: Race sync ask changed in chat" }
        );
        chat.ShouldNotBeNull();
        (
            await PostJson<ApplyCapabilityProposalApi.Response>(
                client,
                "/apply-capability-proposal",
                new { id, proposalId = chat.Proposal!.Id }
            )
        )!.Outcome.ShouldBe("Applied");

        var staleApply = await PostJson<ApplyCapabilityProposalApi.Response>(
            client,
            "/apply-capability-proposal",
            new { id, proposalId = hand.Proposal!.Id }
        );
        staleApply.ShouldNotBeNull();
        staleApply.Outcome.ShouldBeOneOf("Reoffered", "Withdrawn");
    }

    [Fact]
    public async Task hand_criterion_edit_bubbles_to_ask_as_proposal()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Criterion lives in the ask");
        var add = await PostJson<PostCapabilityChatMessageApi.Response>(
            client,
            "/post-capability-chat-message",
            new { id, message = "add criterion: Criterion lives in the ask" }
        );
        (
            await PostJson<ApplyCapabilityProposalApi.Response>(
                client,
                "/apply-capability-proposal",
                new { id, proposalId = add!.Proposal!.Id }
            )
        ).ShouldNotBeNull();

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var criterionId = detail.Criteria[0].Id;

        var proposed = await PostJson<AmendCapabilityCriterionApi.Response>(
            client,
            "/amend-capability-criterion",
            new
            {
                id,
                criterionId,
                statement = "Criterion wording sharpened by hand",
            }
        );
        proposed.ShouldNotBeNull();
        proposed.Outcome.ShouldBe("Proposed");
        proposed.Proposal!.Effects.ShouldContain(e => e.Kind == "AmendAsk");
        proposed.Proposal.Effects.ShouldContain(e => e.Kind == "SharpenCriterion");
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
                    name = $"Sync {id:N}"[..20],
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
