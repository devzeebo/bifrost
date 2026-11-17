using System.Collections.Concurrent;
using System.Text.Json.Nodes;
using Bifrost.MessageBus;
using Bifrost.Skills.Contracts;

namespace Bifrost.WorkerNode;

public sealed record SkillDocument(Guid CapabilityId, Guid VersionId, string Markdown);

public sealed record SkillRef(Guid CapabilityId, Guid? SkillVersionId);

public interface ISkillDocumentCache
{
    Task<SkillDocument> Get(
        SkillRef skillRef,
        IBifrostBus bus,
        CancellationToken cancellationToken
    );
}

public sealed class SkillDocumentCache : ISkillDocumentCache
{
    readonly ConcurrentDictionary<(Guid CapabilityId, Guid VersionId), SkillDocument> _cache =
        new();

    public async Task<SkillDocument> Get(
        SkillRef skillRef,
        IBifrostBus bus,
        CancellationToken cancellationToken
    )
    {
        Guid versionId;
        string markdown;

        if (skillRef.SkillVersionId is { } pinned)
        {
            versionId = pinned;
            if (_cache.TryGetValue((skillRef.CapabilityId, versionId), out var hit))
            {
                return hit;
            }

            var version = await bus.Request<GetSkillVersionApi.Query, GetSkillVersionApi.Response>(
                    new GetSkillVersionApi.Query
                    {
                        Id = skillRef.CapabilityId,
                        VersionId = versionId,
                    },
                    cancellationToken
                )
                .ConfigureAwait(false);

            markdown = version.Snapshot.Markdown;
        }
        else
        {
            var capability = await bus.Request<GetCapabilityApi.Query, GetCapabilityApi.Response>(
                    new GetCapabilityApi.Query { Id = skillRef.CapabilityId },
                    cancellationToken
                )
                .ConfigureAwait(false);

            if (
                !capability.HasPublishedSkill
                || capability.CurrentSkillVersionId is not { } currentVersion
                || string.IsNullOrWhiteSpace(capability.SkillMarkdown)
            )
            {
                throw new InvalidOperationException(
                    $"skill '{skillRef.CapabilityId:D}' has no published skill"
                );
            }

            versionId = currentVersion;
            if (_cache.TryGetValue((skillRef.CapabilityId, versionId), out var hit))
            {
                return hit;
            }

            markdown = capability.SkillMarkdown;
        }

        var document = new SkillDocument(skillRef.CapabilityId, versionId, markdown);
        _cache[(skillRef.CapabilityId, versionId)] = document;
        return document;
    }
}

public static class SkillRefReader
{
    public static IReadOnlyList<SkillRef> ReadFromNodeSpec(JsonNode? data)
    {
        if (data is not JsonObject root)
        {
            return [];
        }

        if (
            !root.TryGetPropertyValue("node", out var nodeNode)
            || nodeNode is not JsonObject node
        )
        {
            return [];
        }

        if (
            !node.TryGetPropertyValue("spec", out var specNode)
            || specNode is not JsonObject spec
        )
        {
            return [];
        }

        if (
            !spec.TryGetPropertyValue("skills", out var skillsNode)
            || skillsNode is not JsonArray skills
        )
        {
            return [];
        }

        var result = new List<SkillRef>();
        foreach (var item in skills)
        {
            if (item is not JsonObject skill)
            {
                throw new InvalidOperationException("skill ref must be an object with capabilityId");
            }

            if (
                !skill.TryGetPropertyValue("capabilityId", out var capabilityNode)
                || capabilityNode is null
                || capabilityNode.GetValueKind() != System.Text.Json.JsonValueKind.String
                || !Guid.TryParse(capabilityNode.GetValue<string>(), out var capabilityId)
            )
            {
                throw new InvalidOperationException(
                    "skill ref requires a GUID capabilityId"
                );
            }

            Guid? versionId = null;
            if (
                skill.TryGetPropertyValue("skillVersionId", out var versionNode)
                && versionNode is not null
                && versionNode.GetValueKind() == System.Text.Json.JsonValueKind.String
            )
            {
                var raw = versionNode.GetValue<string>();
                if (!string.IsNullOrWhiteSpace(raw))
                {
                    if (!Guid.TryParse(raw, out var parsed))
                    {
                        throw new InvalidOperationException(
                            $"skill ref skillVersionId '{raw}' is not a GUID"
                        );
                    }

                    versionId = parsed;
                }
            }

            result.Add(new SkillRef(capabilityId, versionId));
        }

        return result;
    }
}
