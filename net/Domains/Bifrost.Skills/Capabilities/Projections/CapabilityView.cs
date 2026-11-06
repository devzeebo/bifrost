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
        public IReadOnlyList<CriterionSnapshot> Criteria { get; init; } = [];
        public IReadOnlyList<EvalSnapshot> Evals { get; init; } = [];
        public bool HasUnsavedCapabilityDraft { get; init; }
        public bool HasUnsavedSkillDraft { get; init; }
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
            HasUnsavedCapabilityDraft = true,
        };

    public Model Apply(CapabilityLayersAmended e, Model view) =>
        view with
        {
            Ask = e.Ask,
            Criteria = e.Criteria,
            Evals = e.Evals,
            HasUnsavedCapabilityDraft = true,
        };

    public Model Apply(CapabilityRenamed e, Model view) => view with { Name = e.Name };

    public Model Apply(CapabilityVersionRecorded e, Model view) =>
        view with
        {
            Ask = e.Snapshot.Ask,
            Criteria = e.Snapshot.Criteria,
            Evals = e.Snapshot.Evals,
            CurrentCapabilityVersionId = e.VersionId,
            HasUnsavedCapabilityDraft = false,
        };

    public Model Apply(DerivedSkillSaved e, Model view) =>
        view with
        {
            SkillMarkdown = e.Markdown,
            DerivedAgainstCapabilityVersionId = e.DerivedAgainstCapabilityVersionId,
            HasUnsavedSkillDraft = true,
        };

    public Model Apply(SkillVersionRecorded e, Model view) =>
        view with
        {
            SkillMarkdown = e.Snapshot.Markdown,
            DerivedAgainstCapabilityVersionId = e.Snapshot.DerivedAgainstCapabilityVersionId,
            CurrentSkillVersionId = e.VersionId,
            HasUnsavedSkillDraft = false,
        };

    public Model Apply(CapabilityRestored e, Model view) =>
        view with
        {
            Ask = e.Snapshot.Ask,
            Criteria = e.Snapshot.Criteria,
            Evals = e.Snapshot.Evals,
            HasUnsavedCapabilityDraft = true,
        };

    public Model Apply(SkillRestored e, Model view) =>
        view with
        {
            SkillMarkdown = e.Snapshot.Markdown,
            DerivedAgainstCapabilityVersionId = e.Snapshot.DerivedAgainstCapabilityVersionId,
            HasUnsavedSkillDraft = true,
        };
}
