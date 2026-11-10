using Bifrost.Capabilities.Events;
using Marten.Events.Aggregation;

namespace Bifrost.Capabilities.Projections;

public class CapabilityView : SingleStreamProjection<CapabilityView.Model, Guid>
{
    public sealed record Model
    {
        public Guid Id { get; init; }
        public required string Name { get; init; }
        public required string Ask { get; init; }
        public string SkillMarkdown { get; init; } = "";
        public Guid? CurrentCapabilityVersionId { get; init; }
        public Guid? CurrentSkillVersionId { get; init; }
        public Guid? DerivedAgainstCapabilityVersionId { get; init; }
        public Guid? DerivedAgainstSuiteRunId { get; init; }
        public IReadOnlyList<CriterionSnapshot> Criteria { get; init; } = [];
        public IReadOnlyList<EvalSnapshot> Evals { get; init; } = [];
        public bool HasUnsavedCapabilityDraft { get; init; }
        public bool HasUnsavedSkillDraft { get; init; }
        public CapabilityVersionSnapshot? LastRecordedCapabilitySnapshot { get; init; }
        public SkillVersionSnapshot? LastRecordedSkillSnapshot { get; init; }
    }

    public Model Create(CapabilityCreated e) =>
        new()
        {
            Id = e.Id,
            Name = e.Name,
            Ask = e.Ask,
        };

    public Model Apply(CapabilityAskAmended e, Model view) =>
        view with
        {
            Ask = e.Ask,
            HasUnsavedCapabilityDraft = !CapabilityMatches(
                view.LastRecordedCapabilitySnapshot,
                e.Ask,
                view.Criteria,
                view.Evals
            ),
        };

    public Model Apply(CapabilityLayersAmended e, Model view) =>
        view with
        {
            Ask = e.Ask,
            Criteria = e.Criteria,
            Evals = e.Evals,
            HasUnsavedCapabilityDraft = !CapabilityMatches(
                view.LastRecordedCapabilitySnapshot,
                e.Ask,
                e.Criteria,
                e.Evals
            ),
        };

    public Model Apply(CapabilityRenamed e, Model view) => view with { Name = e.Name };

    public Model Apply(CapabilityVersionRecorded e, Model view) =>
        view with
        {
            Ask = e.Snapshot.Ask,
            Criteria = e.Snapshot.Criteria,
            Evals = e.Snapshot.Evals,
            CurrentCapabilityVersionId = e.VersionId,
            LastRecordedCapabilitySnapshot = e.Snapshot,
            HasUnsavedCapabilityDraft = false,
        };

    public Model Apply(DerivedSkillSaved e, Model view) =>
        view with
        {
            SkillMarkdown = e.Markdown,
            DerivedAgainstCapabilityVersionId = e.DerivedAgainstCapabilityVersionId,
            DerivedAgainstSuiteRunId = e.DerivedAgainstSuiteRunId,
            HasUnsavedSkillDraft = !SkillMatches(
                view.LastRecordedSkillSnapshot,
                e.Markdown,
                e.DerivedAgainstCapabilityVersionId,
                e.DerivedAgainstSuiteRunId
            ),
        };

    public Model Apply(SkillVersionRecorded e, Model view) =>
        view with
        {
            SkillMarkdown = e.Snapshot.Markdown,
            DerivedAgainstCapabilityVersionId = e.Snapshot.DerivedAgainstCapabilityVersionId,
            DerivedAgainstSuiteRunId = e.Snapshot.DerivedAgainstSuiteRunId,
            CurrentSkillVersionId = e.VersionId,
            LastRecordedSkillSnapshot = e.Snapshot,
            HasUnsavedSkillDraft = false,
        };

    public Model Apply(CapabilityRestored e, Model view) =>
        view with
        {
            Ask = e.Snapshot.Ask,
            Criteria = e.Snapshot.Criteria,
            Evals = e.Snapshot.Evals,
            HasUnsavedCapabilityDraft = !CapabilityMatches(
                view.LastRecordedCapabilitySnapshot,
                e.Snapshot.Ask,
                e.Snapshot.Criteria,
                e.Snapshot.Evals
            ),
        };

    public Model Apply(SkillRestored e, Model view) =>
        view with
        {
            SkillMarkdown = e.Snapshot.Markdown,
            DerivedAgainstCapabilityVersionId = e.Snapshot.DerivedAgainstCapabilityVersionId,
            DerivedAgainstSuiteRunId = e.Snapshot.DerivedAgainstSuiteRunId,
            HasUnsavedSkillDraft = !SkillMatches(
                view.LastRecordedSkillSnapshot,
                e.Snapshot.Markdown,
                e.Snapshot.DerivedAgainstCapabilityVersionId,
                e.Snapshot.DerivedAgainstSuiteRunId
            ),
        };

    static bool CapabilityMatches(
        CapabilityVersionSnapshot? last,
        string ask,
        IReadOnlyList<CriterionSnapshot> criteria,
        IReadOnlyList<EvalSnapshot> evals
    )
    {
        if (last is null || last.Ask != ask)
        {
            return false;
        }

        if (last.Criteria.Count != criteria.Count || last.Evals.Count != evals.Count)
        {
            return false;
        }

        for (var i = 0; i < criteria.Count; i++)
        {
            if (last.Criteria[i] != criteria[i])
            {
                return false;
            }
        }

        for (var i = 0; i < evals.Count; i++)
        {
            if (last.Evals[i] != evals[i])
            {
                return false;
            }
        }

        return true;
    }

    static bool SkillMatches(
        SkillVersionSnapshot? last,
        string markdown,
        Guid derivedAgainstCapabilityVersionId,
        Guid? derivedAgainstSuiteRunId
    ) =>
        last is not null
        && last.Markdown == markdown
        && last.DerivedAgainstCapabilityVersionId == derivedAgainstCapabilityVersionId
        && last.DerivedAgainstSuiteRunId == derivedAgainstSuiteRunId;
}
