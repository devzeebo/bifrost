using Bifrost.Capabilities.Projections;
using Bifrost.Skills.Contracts;
using Marten;

namespace Bifrost.Capabilities.Queries;

/// <summary>
/// Skill staleness is a read comparison: derived-against capability version vs current.
/// No stored flag.
/// </summary>
public static class SkillStaleness
{
    public static async Task<(
        bool IsSkillStale,
        SkillStaleLayers Layers
    )> Read(CapabilityView.Model item, IQuerySession session)
    {
        if (
            string.IsNullOrEmpty(item.SkillMarkdown)
            || item.DerivedAgainstCapabilityVersionId is not { } against
            || item.CurrentCapabilityVersionId is not { } current
        )
        {
            return (false, SkillStaleLayers.None);
        }

        if (against == current)
        {
            return (false, SkillStaleLayers.None);
        }

        var againstVersion = await session.LoadAsync<CapabilityVersionView.Model>(against);
        if (againstVersion is null)
        {
            return (
                true,
                new SkillStaleLayers
                {
                    AskChanged = true,
                    CriteriaChanged = true,
                    EvalsChanged = true,
                }
            );
        }

        var prior = againstVersion.Snapshot;
        var layers = new SkillStaleLayers
        {
            AskChanged = !string.Equals(prior.Ask, item.Ask, StringComparison.Ordinal),
            CriteriaChanged = !SameCriteria(prior.Criteria, item.Criteria),
            EvalsChanged = !SameEvals(prior.Evals, item.Evals),
        };

        return (true, layers);
    }

    static bool SameCriteria(
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

    static bool SameEvals(IReadOnlyList<EvalSnapshot> left, IReadOnlyList<EvalSnapshot> right)
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
                || left[i].Checks.Count != right[i].Checks.Count
            )
            {
                return false;
            }

            for (var c = 0; c < left[i].Checks.Count; c++)
            {
                if (
                    left[i].Checks[c].Id != right[i].Checks[c].Id
                    || left[i].Checks[c].Statement != right[i].Checks[c].Statement
                    || left[i].Checks[c].Kind != right[i].Checks[c].Kind
                    || left[i].Checks[c].Script != right[i].Checks[c].Script
                )
                {
                    return false;
                }
            }
        }

        return true;
    }
}

public sealed record SkillStaleLayers
{
    public static SkillStaleLayers None { get; } = new();

    public bool AskChanged { get; init; }
    public bool CriteriaChanged { get; init; }
    public bool EvalsChanged { get; init; }
}
