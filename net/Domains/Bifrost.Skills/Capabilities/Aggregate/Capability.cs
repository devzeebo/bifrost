using Bifrost.Capabilities.Events;

namespace Bifrost.Capabilities.Aggregate;

public class Capability
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Ask { get; set; }
    public string SkillMarkdown { get; set; } = "";
    public Guid? CurrentCapabilityVersionId { get; set; }
    public Guid? CurrentSkillVersionId { get; set; }
    public Guid? DerivedAgainstCapabilityVersionId { get; set; }
    public List<CriterionSnapshot> Criteria { get; set; } = [];
    public List<EvalSnapshot> Evals { get; set; } = [];
    public CapabilityVersionSnapshot? LastRecordedCapabilitySnapshot { get; set; }
    public SkillVersionSnapshot? LastRecordedSkillSnapshot { get; set; }

    public CapabilityVersionSnapshot DraftCapabilitySnapshot() =>
        new()
        {
            Ask = Ask,
            Criteria = Criteria.ToArray(),
            Evals = Evals.ToArray(),
        };

    public SkillVersionSnapshot? DraftSkillSnapshot() =>
        DerivedAgainstCapabilityVersionId is { } against
            ? new SkillVersionSnapshot
            {
                Markdown = SkillMarkdown,
                DerivedAgainstCapabilityVersionId = against,
            }
            : null;

    public bool CapabilityContentEquals(CapabilityVersionSnapshot snapshot) =>
        LastRecordedCapabilitySnapshot is { } last
        && SnapshotEquals(last, snapshot);

    public bool SkillContentEquals(SkillVersionSnapshot snapshot) =>
        LastRecordedSkillSnapshot is { } last
        && SkillSnapshotEquals(last, snapshot);

    public void Apply(CapabilityCreated e)
    {
        Id = e.Id;
        Name = e.Name;
        Ask = e.Ask;
        Criteria = [];
        Evals = [];
    }

    public void Apply(CapabilityAskAmended e)
    {
        Ask = e.Ask;
    }

    public void Apply(CapabilityLayersAmended e)
    {
        Ask = e.Ask;
        Criteria = e.Criteria.ToList();
        Evals = e.Evals.ToList();
    }

    public void Apply(CapabilityRenamed e)
    {
        Name = e.Name;
    }

    public void Apply(CapabilityVersionRecorded e)
    {
        CurrentCapabilityVersionId = e.VersionId;
        LastRecordedCapabilitySnapshot = e.Snapshot;
        Ask = e.Snapshot.Ask;
        Criteria = e.Snapshot.Criteria.ToList();
        Evals = e.Snapshot.Evals.ToList();
    }

    public void Apply(DerivedSkillSaved e)
    {
        SkillMarkdown = e.Markdown;
        DerivedAgainstCapabilityVersionId = e.DerivedAgainstCapabilityVersionId;
    }

    public void Apply(SkillVersionRecorded e)
    {
        CurrentSkillVersionId = e.VersionId;
        LastRecordedSkillSnapshot = e.Snapshot;
        SkillMarkdown = e.Snapshot.Markdown;
        DerivedAgainstCapabilityVersionId = e.Snapshot.DerivedAgainstCapabilityVersionId;
    }

    public void Apply(CapabilityRestored e)
    {
        Ask = e.Snapshot.Ask;
        Criteria = e.Snapshot.Criteria.ToList();
        Evals = e.Snapshot.Evals.ToList();
    }

    public void Apply(SkillRestored e)
    {
        SkillMarkdown = e.Snapshot.Markdown;
        DerivedAgainstCapabilityVersionId = e.Snapshot.DerivedAgainstCapabilityVersionId;
    }

    static bool SnapshotEquals(CapabilityVersionSnapshot left, CapabilityVersionSnapshot right) =>
        left.Ask == right.Ask
        && CriteriaEqual(left.Criteria, right.Criteria)
        && EvalsEqual(left.Evals, right.Evals);

    static bool SkillSnapshotEquals(SkillVersionSnapshot left, SkillVersionSnapshot right) =>
        left.Markdown == right.Markdown
        && left.DerivedAgainstCapabilityVersionId == right.DerivedAgainstCapabilityVersionId;

    static bool CriteriaEqual(
        IReadOnlyList<CriterionSnapshot> left,
        IReadOnlyList<CriterionSnapshot> right
    )
    {
        if (left.Count != right.Count)
        {
            return false;
        }

        for (var i = 0; i < left.Count; i++)
        {
            if (left[i].Id != right[i].Id || left[i].Statement != right[i].Statement)
            {
                return false;
            }
        }

        return true;
    }

    static bool EvalsEqual(IReadOnlyList<EvalSnapshot> left, IReadOnlyList<EvalSnapshot> right)
    {
        if (left.Count != right.Count)
        {
            return false;
        }

        for (var i = 0; i < left.Count; i++)
        {
            if (
                left[i].Id != right[i].Id
                || left[i].CriterionId != right[i].CriterionId
                || left[i].Scenario != right[i].Scenario
                || left[i].Prompt != right[i].Prompt
                || left[i].Context != right[i].Context
                || !ChecksEqual(left[i].Checks, right[i].Checks)
            )
            {
                return false;
            }
        }

        return true;
    }

    static bool ChecksEqual(IReadOnlyList<CheckSnapshot> left, IReadOnlyList<CheckSnapshot> right)
    {
        if (left.Count != right.Count)
        {
            return false;
        }

        for (var i = 0; i < left.Count; i++)
        {
            if (
                left[i].Id != right[i].Id
                || left[i].Statement != right[i].Statement
                || !string.Equals(left[i].Kind, right[i].Kind, StringComparison.Ordinal)
                || !string.Equals(left[i].Script, right[i].Script, StringComparison.Ordinal)
            )
            {
                return false;
            }
        }

        return true;
    }
}
