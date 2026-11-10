using Bifrost.Skills.Contracts;
using System.Text;

namespace Bifrost.Capabilities.Editor;

/// <summary>
/// Deterministic skill markdown drafted from the current agreement (ask/criteria/evals).
/// Used by sync and scripted derive so all four layers stay one reviewable proposal.
/// </summary>
public static class SkillAgreementDraft
{
    public static string From(CapabilityVersionSnapshot agreement)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Skill");
        sb.AppendLine();
        sb.AppendLine(agreement.Ask.Trim());
        sb.AppendLine();
        if (agreement.Criteria.Count > 0)
        {
            sb.AppendLine("## Criteria");
            sb.AppendLine();
            foreach (var criterion in agreement.Criteria)
            {
                sb.Append("- ");
                sb.Append(criterion.Statement.Trim());
                sb.Append(" (`");
                sb.Append(criterion.Id.ToString("N"));
                sb.AppendLine("`)");
                foreach (var eval in agreement.Evals.Where(e => e.CriterionId == criterion.Id))
                {
                    sb.Append("  - Eval: ");
                    sb.AppendLine(eval.Scenario.Trim());
                }
            }
        }

        return sb.ToString().TrimEnd() + "\n";
    }

    public static IReadOnlyList<Guid> ServedCriterionIds(CapabilityVersionSnapshot agreement) =>
        [.. agreement.Criteria.Select(c => c.Id)];
}
