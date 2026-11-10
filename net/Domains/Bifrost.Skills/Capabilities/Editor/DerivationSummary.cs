using Bifrost.Skills.Contracts;
using System.Text;

namespace Bifrost.Capabilities.Editor;

/// <summary>
/// Composition-time fixed text + live suite-run account for derivation proposals.
/// </summary>
public static class DerivationSummary
{
    public const string RunLessPlainStatement =
        "No completed suite run; the first run is expected to fail some evals — that is the loop working.";

    public static string Composition(
        CapabilityVersionSnapshot agreement,
        IReadOnlyList<Guid> servedCriterionIds,
        IReadOnlyList<LeftOut> leftOut
    )
    {
        var sb = new StringBuilder();
        sb.Append("Derive skill");
        if (servedCriterionIds.Count > 0)
        {
            sb.Append(" serving ");
            sb.Append(servedCriterionIds.Count);
            sb.Append(servedCriterionIds.Count == 1 ? " criterion" : " criteria");
        }

        sb.Append('.');
        foreach (var item in leftOut)
        {
            sb.Append(' ');
            sb.Append(item.Reason);
            sb.Append(": ");
            sb.Append(Short(item.Statement));
            sb.Append('.');
        }

        foreach (var criterion in agreement.Criteria.Where(c => servedCriterionIds.Contains(c.Id)))
        {
            var evals = agreement.Evals.Where(e => e.CriterionId == criterion.Id).ToList();
            sb.Append(" Part for ");
            sb.Append(Short(criterion.Statement));
            if (evals.Count > 0)
            {
                sb.Append(" covers eval(s): ");
                sb.Append(string.Join("; ", evals.Select(e => Short(e.Scenario))));
            }

            sb.Append('.');
        }

        return sb.ToString().Trim();
    }

    public static string Display(string compositionSummary, DerivationSuiteBasis? basis)
    {
        if (basis?.SuiteRunId is null)
        {
            if (compositionSummary.Contains(RunLessPlainStatement, StringComparison.Ordinal))
            {
                return compositionSummary;
            }

            return $"{compositionSummary} {RunLessPlainStatement}";
        }

        var sb = new StringBuilder();
        sb.Append(StripLiveAccount(compositionSummary).Trim());
        sb.Append(" Basis suite run ");
        sb.Append(basis.SuiteRunId.Value.ToString("N"));
        sb.Append(':');

        if (basis.FailedEvalIds.Count > 0)
        {
            sb.Append(" failing ");
            sb.Append(basis.FailedEvalIds.Count);
            sb.Append(basis.FailedEvalIds.Count == 1 ? " eval;" : " evals;");
        }
        else
        {
            sb.Append(" no settled failures;");
        }

        if (basis.PassedEvalIds.Count > 0)
        {
            sb.Append(" passing ");
            sb.Append(basis.PassedEvalIds.Count);
            sb.Append(';');
        }

        if (basis.Unsettled.Count > 0)
        {
            sb.Append(" unsettled ");
            sb.Append(basis.Unsettled.Count);
            sb.Append(" (");
            sb.Append(
                string.Join(
                    ", ",
                    basis.Unsettled.Select(u =>
                        u.Situation is { Length: > 0 } s
                            ? $"{u.Status}: {Short(s)}"
                            : u.Status
                    )
                )
            );
            sb.Append(");");
        }

        if (basis.MovedEvalIds.Count > 0 || basis.MovedCriterionIds.Count > 0)
        {
            sb.Append(" words moved since this run for ");
            var parts = new List<string>();
            if (basis.MovedCriterionIds.Count > 0)
            {
                parts.Add(
                    basis.MovedCriterionIds.Count == 1
                        ? "1 criterion"
                        : $"{basis.MovedCriterionIds.Count} criteria"
                );
            }

            if (basis.MovedEvalIds.Count > 0)
            {
                parts.Add(
                    $"{basis.MovedEvalIds.Count} eval{(basis.MovedEvalIds.Count == 1 ? "" : "s")}"
                );
            }

            sb.Append(string.Join(" and ", parts));
            sb.Append('.');
        }

        return sb.ToString().Trim();
    }

    public static string WithRunLessPlain(string compositionSummary) =>
        compositionSummary.Contains(RunLessPlainStatement, StringComparison.Ordinal)
            ? compositionSummary
            : $"{compositionSummary} {RunLessPlainStatement}";

    public sealed record LeftOut(string Statement, string Reason);

    static string StripLiveAccount(string summary)
    {
        const string marker = " Basis suite run ";
        var index = summary.IndexOf(marker, StringComparison.Ordinal);
        return index < 0 ? summary : summary[..index];
    }

    static string Short(string text)
    {
        var compact = text.Trim().Replace('\n', ' ');
        return compact.Length <= 80 ? compact : compact[..77] + "…";
    }
}
