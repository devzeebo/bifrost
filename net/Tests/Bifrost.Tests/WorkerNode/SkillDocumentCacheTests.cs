using Bifrost.MessageBus;
using Bifrost.Skills.Contracts;
using Bifrost.WorkerNode;
using Shouldly;

namespace Bifrost.Tests.WorkerNode;

public class SkillDocumentCacheTests
{
    [Fact]
    public async Task caches_pinned_skill_version()
    {
        var capabilityId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var bus = new SkillsBus(capabilityId, versionId, "# Skill\n");
        var cache = new SkillDocumentCache();

        var first = await cache.Get(new SkillRef(capabilityId, versionId), bus, CancellationToken.None);
        var second = await cache.Get(new SkillRef(capabilityId, versionId), bus, CancellationToken.None);

        first.Markdown.ShouldBe("# Skill\n");
        second.Markdown.ShouldBe("# Skill\n");
        bus.VersionFetches.ShouldBe(1);
    }

    [Fact]
    public async Task resolves_current_published_skill_when_version_omitted()
    {
        var capabilityId = Guid.NewGuid();
        var versionId = Guid.NewGuid();
        var bus = new SkillsBus(capabilityId, versionId, "# Current\n");
        var cache = new SkillDocumentCache();

        var document = await cache.Get(
            new SkillRef(capabilityId, null),
            bus,
            CancellationToken.None
        );

        document.VersionId.ShouldBe(versionId);
        document.Markdown.ShouldBe("# Current\n");
        bus.CapabilityFetches.ShouldBe(1);
        bus.VersionFetches.ShouldBe(0);
    }

    sealed class SkillsBus(Guid capabilityId, Guid versionId, string markdown) : IBifrostBus
    {
        public int VersionFetches { get; private set; }
        public int CapabilityFetches { get; private set; }

        public Task<TResponse> Request<TRequest, TResponse>(
            TRequest request,
            CancellationToken cancellationToken = default
        )
        {
            object response = request switch
            {
                GetSkillVersionApi.Query q when q.Id == capabilityId && q.VersionId == versionId =>
                    RecordVersion(),
                GetCapabilityApi.Query q when q.Id == capabilityId => RecordCapability(),
                _ => throw new NotSupportedException(request!.GetType().Name),
            };
            return Task.FromResult((TResponse)response);
        }

        public Task Publish<TEvent>(TEvent @event, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        GetSkillVersionApi.Response RecordVersion()
        {
            VersionFetches++;
            return new GetSkillVersionApi.Response
            {
                VersionId = versionId,
                CapabilityId = capabilityId,
                RecordedAt = DateTimeOffset.UtcNow,
                Snapshot = new SkillVersionSnapshot
                {
                    Markdown = markdown,
                    DerivedAgainstCapabilityVersionId = Guid.NewGuid(),
                    DerivedAgainstSuiteRunId = null,
                },
            };
        }

        GetCapabilityApi.Response RecordCapability()
        {
            CapabilityFetches++;
            return new GetCapabilityApi.Response
            {
                Id = capabilityId,
                Name = "cap",
                Ask = "ask",
                Criteria = [],
                Evals = [],
                HasPublishedSkill = true,
                SkillMarkdown = markdown,
                CurrentSkillVersionId = versionId,
            };
        }
    }
}
