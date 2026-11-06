using System.Text;
using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Editor;

/// <summary>
/// Deterministic behind-the-scenes authorship for script checks (dev/tests and direct amend).
/// The HTTP editor authors richer TypeScript; this keeps identity and the sealed contract shape.
/// </summary>
public static class CheckDerivation
{
    public static CheckSnapshot ScriptCheck(
        Guid id,
        string criterionStatement,
        string scenario
    ) =>
        new()
        {
            Id = id,
            Kind = CheckKinds.Script,
            Statement = PlainSentence(criterionStatement),
            Script = TypeScriptBody(scenario, criterionStatement),
        };

    public static CheckSnapshot HumanReviewCheck(Guid id, string criterionStatement) =>
        new()
        {
            Id = id,
            Kind = CheckKinds.HumanReview,
            Statement = PlainSentence(criterionStatement),
            Script = null,
        };

    public static IReadOnlyList<CheckSnapshot> ReDerive(
        IReadOnlyList<CheckSnapshot> existing,
        string criterionStatement,
        string scenario
    )
    {
        if (existing.Count == 0)
        {
            return [ScriptCheck(Guid.NewGuid(), criterionStatement, scenario)];
        }

        return
        [
            .. existing.Select(check =>
                string.Equals(check.Kind, CheckKinds.HumanReview, StringComparison.Ordinal)
                    ? HumanReviewCheck(check.Id, criterionStatement)
                    : ScriptCheck(check.Id, criterionStatement, scenario)
            ),
        ];
    }

    public static IReadOnlyList<CheckSnapshot> ApplyKindOverrides(
        IReadOnlyList<CheckSnapshot> existing,
        IReadOnlyList<CheckSnapshot> requested,
        string criterionStatement,
        string scenario
    )
    {
        if (requested.Count == 0)
        {
            return ReDerive(existing, criterionStatement, scenario);
        }

        var byId = existing.ToDictionary(c => c.Id);
        var result = new List<CheckSnapshot>(requested.Count);
        foreach (var request in requested)
        {
            var kind = NormalizeKind(request.Kind);
            if (kind == CheckKinds.HumanReview)
            {
                result.Add(HumanReviewCheck(request.Id, criterionStatement));
                continue;
            }

            if (
                byId.TryGetValue(request.Id, out var prior)
                && string.Equals(prior.Kind, CheckKinds.Script, StringComparison.Ordinal)
                && !string.IsNullOrWhiteSpace(prior.Script)
                && string.Equals(
                    prior.Statement,
                    PlainSentence(criterionStatement),
                    StringComparison.Ordinal
                )
            )
            {
                // Keep existing script when kind stays Script and wording is unchanged.
                result.Add(
                    prior with
                    {
                        Kind = CheckKinds.Script,
                        Statement = PlainSentence(criterionStatement),
                    }
                );
                continue;
            }

            result.Add(ScriptCheck(request.Id, criterionStatement, scenario));
        }

        return result;
    }

    public static string PlainSentence(string criterionStatement)
    {
        var trimmed = criterionStatement.Trim();
        return string.IsNullOrEmpty(trimmed)
            ? "The work satisfies the criterion."
            : $"The work satisfies: {trimmed}";
    }

    public static string NormalizeKind(string? kind) =>
        string.Equals(kind, CheckKinds.HumanReview, StringComparison.OrdinalIgnoreCase)
            ? CheckKinds.HumanReview
            : CheckKinds.Script;

    static string TypeScriptBody(string scenario, string criterionStatement)
    {
        var sb = new StringBuilder();
        sb.AppendLine("// Auto-authored script check — do not hand-edit.");
        sb.AppendLine($"// Criterion: {EscapeComment(criterionStatement)}");
        sb.AppendLine($"// Scenario: {EscapeComment(scenario)}");
        sb.AppendLine(
            "export default function check(transcript: string, context: string): boolean {"
        );
        sb.AppendLine("  const haystack = `${context}\\n${transcript}`.toLowerCase();");
        sb.AppendLine($"  const needle = {ToTsString(criterionStatement.Trim().ToLowerInvariant())};");
        sb.AppendLine("  return needle.length === 0 || haystack.includes(needle);");
        sb.AppendLine("}");
        return sb.ToString();
    }

    static string EscapeComment(string value) =>
        value.Replace('\r', ' ').Replace('\n', ' ').Trim();

    static string ToTsString(string value)
    {
        var escaped = value
            .Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("'", "\\'", StringComparison.Ordinal);
        return $"'{escaped}'";
    }
}
