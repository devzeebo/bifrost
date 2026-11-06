extern alias Skills;

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Bifrost.Skills.Contracts;
using Shouldly;

namespace Bifrost.Tests.Api;

[Collection("skills")]
public class SkillsVersioningTests
{
    readonly SkillsApiFactory _factory;
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public SkillsVersioningTests(SkillsApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task create_records_initial_capability_version()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Versioned ask");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        detail.CurrentCapabilityVersionId.ShouldNotBeNull();
        detail.HasUnsavedCapabilityDraft.ShouldBeFalse();

        var versions = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        versions.ShouldNotBeNull();
        versions.Items.Count.ShouldBe(1);
        versions.Items[0].VersionId.ShouldBe(detail.CurrentCapabilityVersionId!.Value);

        var version = await Query<GetCapabilityVersionApi.Response>(
            client,
            $"/get-capability-version/{id}/{versions.Items[0].VersionId}"
        );
        version.ShouldNotBeNull();
        version.Snapshot.Ask.ShouldBe("Versioned ask");
        version.Snapshot.Criteria.ShouldBeEmpty();
        version.Snapshot.Evals.ShouldBeEmpty();
    }

    [Fact]
    public async Task identical_amend_records_no_version()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Stable ask");

        (
            await Post(client, "/amend-capability-ask", new { id, ask = "Stable ask" })
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var versions = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        versions.ShouldNotBeNull();
        versions.Items.Count.ShouldBe(1);
    }

    [Fact]
    public async Task changed_ask_records_new_version_newest_first()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "First ask");

        (
            await Post(client, "/amend-capability-ask", new { id, ask = "Second ask" })
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var versions = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        versions.ShouldNotBeNull();
        versions.Items.Count.ShouldBe(2);
        versions.Items[0].RecordedAt.ShouldBeGreaterThanOrEqualTo(versions.Items[1].RecordedAt);

        var newest = await Query<GetCapabilityVersionApi.Response>(
            client,
            $"/get-capability-version/{id}/{versions.Items[0].VersionId}"
        );
        newest.ShouldNotBeNull();
        newest.Snapshot.Ask.ShouldBe("Second ask");
    }

    [Fact]
    public async Task compare_capability_versions_returns_both_snapshots()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Left ask");
        (
            await Post(client, "/amend-capability-ask", new { id, ask = "Right ask" })
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var versions = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        versions.ShouldNotBeNull();
        var rightId = versions.Items[0].VersionId;
        var leftId = versions.Items[1].VersionId;

        var compare = await Query<CompareCapabilityVersionsApi.Response>(
            client,
            $"/compare-capability-versions/{id}/{leftId}/{rightId}"
        );
        compare.ShouldNotBeNull();
        compare.Left.Snapshot.Ask.ShouldBe("Left ask");
        compare.Right.Snapshot.Ask.ShouldBe("Right ask");
    }

    [Fact]
    public async Task restore_updates_draft_without_new_version_then_save_versions()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Original ask");
        (
            await Post(client, "/amend-capability-ask", new { id, ask = "Amended ask" })
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var versionsBefore = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        versionsBefore.ShouldNotBeNull();
        var originalVersionId = versionsBefore.Items[1].VersionId;

        (
            await Post(
                client,
                "/restore-capability-version",
                new { id, versionId = originalVersionId }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var afterRestore = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        afterRestore.ShouldNotBeNull();
        afterRestore.Ask.ShouldBe("Original ask");
        afterRestore.HasUnsavedCapabilityDraft.ShouldBeTrue();

        var versionsAfterRestore = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        versionsAfterRestore.ShouldNotBeNull();
        versionsAfterRestore.Items.Count.ShouldBe(2);

        (
            await Post(client, "/amend-capability-ask", new { id, ask = "Original ask" })
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var versionsAfterSave = await Query<ListCapabilityVersionsApi.Response>(
            client,
            $"/list-capability-versions/{id}"
        );
        versionsAfterSave.ShouldNotBeNull();
        versionsAfterSave.Items.Count.ShouldBe(3);

        var newest = await Query<GetCapabilityVersionApi.Response>(
            client,
            $"/get-capability-version/{id}/{versionsAfterSave.Items[0].VersionId}"
        );
        newest.ShouldNotBeNull();
        newest.Snapshot.Ask.ShouldBe("Original ask");

        var afterSave = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        afterSave.ShouldNotBeNull();
        afterSave.HasUnsavedCapabilityDraft.ShouldBeFalse();
    }

    [Fact]
    public async Task skill_save_versions_and_noop_and_restore()
    {
        var client = _factory.CreateClient();
        var id = await CreateCapability(client, "Capability for skill");

        var detail = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        detail.ShouldNotBeNull();
        var capabilityVersionId = detail.CurrentCapabilityVersionId!.Value;

        (
            await Post(
                client,
                "/save-derived-skill",
                new { id, markdown = "# Skill\n\nDo the work." }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var afterSave = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        afterSave.ShouldNotBeNull();
        afterSave.SkillMarkdown.ShouldBe("# Skill\n\nDo the work.");
        afterSave.CurrentSkillVersionId.ShouldNotBeNull();
        afterSave.DerivedAgainstCapabilityVersionId.ShouldBe(capabilityVersionId);
        afterSave.HasUnsavedSkillDraft.ShouldBeFalse();

        var skillVersions = await Query<ListSkillVersionsApi.Response>(
            client,
            $"/list-skill-versions/{id}"
        );
        skillVersions.ShouldNotBeNull();
        skillVersions.Items.Count.ShouldBe(1);
        skillVersions
            .Items[0]
            .DerivedAgainstCapabilityVersionId.ShouldBe(capabilityVersionId);

        (
            await Post(
                client,
                "/save-derived-skill",
                new { id, markdown = "# Skill\n\nDo the work." }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        skillVersions = await Query<ListSkillVersionsApi.Response>(
            client,
            $"/list-skill-versions/{id}"
        );
        skillVersions.ShouldNotBeNull();
        skillVersions.Items.Count.ShouldBe(1);

        (
            await Post(
                client,
                "/save-derived-skill",
                new { id, markdown = "# Skill\n\nRevised." }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        skillVersions = await Query<ListSkillVersionsApi.Response>(
            client,
            $"/list-skill-versions/{id}"
        );
        skillVersions.ShouldNotBeNull();
        skillVersions.Items.Count.ShouldBe(2);
        var olderSkillVersionId = skillVersions.Items[1].VersionId;

        var compare = await Query<CompareSkillVersionsApi.Response>(
            client,
            $"/compare-skill-versions/{id}/{olderSkillVersionId}/{skillVersions.Items[0].VersionId}"
        );
        compare.ShouldNotBeNull();
        compare.Left.Snapshot.Markdown.ShouldBe("# Skill\n\nDo the work.");
        compare.Right.Snapshot.Markdown.ShouldBe("# Skill\n\nRevised.");

        (
            await Post(
                client,
                "/restore-skill-version",
                new { id, versionId = olderSkillVersionId }
            )
        ).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var afterRestore = await Query<GetCapabilityApi.Response>(client, $"/get-capability/{id}");
        afterRestore.ShouldNotBeNull();
        afterRestore.SkillMarkdown.ShouldBe("# Skill\n\nDo the work.");
        afterRestore.HasUnsavedSkillDraft.ShouldBeTrue();

        var skillVersionsAfterRestore = await Query<ListSkillVersionsApi.Response>(
            client,
            $"/list-skill-versions/{id}"
        );
        skillVersionsAfterRestore.ShouldNotBeNull();
        skillVersionsAfterRestore.Items.Count.ShouldBe(2);
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
                    name = $"Capability {id:N}"[..24],
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

    static Task<T?> Query<T>(HttpClient client, string path) => Query<T>(client, path, new { });

    static async Task<T?> Query<T>(HttpClient client, string path, object body)
    {
        var response = await SendQuery(client, path, body);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions);
    }

    static async Task<HttpResponseMessage> SendQuery(HttpClient client, string path, object body)
    {
        var request = new HttpRequestMessage(new HttpMethod("QUERY"), path)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(body),
                Encoding.UTF8,
                "application/json"
            ),
        };
        return await client.SendAsync(request);
    }
}
