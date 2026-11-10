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
        string scenario,
        int? timeoutMs = null
    ) =>
        new()
        {
            Id = id,
            Kind = CheckKinds.Script,
            Statement = PlainSentence(criterionStatement),
            Script = TypeScriptBody(scenario, criterionStatement),
            TimeoutMs = timeoutMs,
        };

    public static CheckSnapshot HumanReviewCheck(
        Guid id,
        string criterionStatement,
        int? timeoutMs = null
    ) =>
        new()
        {
            Id = id,
            Kind = CheckKinds.HumanReview,
            Statement = PlainSentence(criterionStatement),
            Script = null,
            TimeoutMs = timeoutMs,
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
                    ? HumanReviewCheck(check.Id, criterionStatement, check.TimeoutMs)
                    : ScriptCheck(check.Id, criterionStatement, scenario, check.TimeoutMs)
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
            var kind = RequireKind(request.Kind);
            var timeoutMs = request.TimeoutMs ?? (byId.TryGetValue(request.Id, out var kept)
                ? kept.TimeoutMs
                : null);
            if (kind == CheckKinds.HumanReview)
            {
                result.Add(HumanReviewCheck(request.Id, criterionStatement, timeoutMs));
                continue;
            }

            var requestedStatement = (request.Statement ?? "").Trim();
            if (
                byId.TryGetValue(request.Id, out var prior)
                && string.Equals(prior.Kind, CheckKinds.Script, StringComparison.Ordinal)
                && !string.IsNullOrWhiteSpace(prior.Script)
                && string.Equals(prior.Statement, requestedStatement, StringComparison.Ordinal)
            )
            {
                // Keep authored script when kind stays Script and the check's own wording is unchanged
                // (LLM statements will not match PlainSentence — compare to the request, not the generator).
                result.Add(
                    prior with
                    {
                        Kind = CheckKinds.Script,
                        TimeoutMs = timeoutMs,
                    }
                );
                continue;
            }

            result.Add(ScriptCheck(request.Id, criterionStatement, scenario, timeoutMs));
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

    public static string RequireKind(string? kind)
    {
        if (
            string.IsNullOrWhiteSpace(kind)
            || string.Equals(kind, CheckKinds.Script, StringComparison.OrdinalIgnoreCase)
        )
        {
            return CheckKinds.Script;
        }

        if (string.Equals(kind, CheckKinds.HumanReview, StringComparison.OrdinalIgnoreCase))
        {
            return CheckKinds.HumanReview;
        }

        throw new ArgumentException($"Unknown check kind '{kind}'.", nameof(kind));
    }

    /// <summary>Legacy alias: unknown kinds throw via <see cref="RequireKind"/>.</summary>
    public static string NormalizeKind(string? kind) => RequireKind(kind);

    public static string HydrateScript(Guid id, string statement) =>
        ScriptCheck(id, statement, statement).Script!;

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
            .Replace("'", "\\'", StringComparison.Ordinal)
            .Replace("\r", "\\r", StringComparison.Ordinal)
            .Replace("\n", "\\n", StringComparison.Ordinal)
            .Replace("\t", "\\t", StringComparison.Ordinal);
        return $"'{escaped}'";
    }
}
