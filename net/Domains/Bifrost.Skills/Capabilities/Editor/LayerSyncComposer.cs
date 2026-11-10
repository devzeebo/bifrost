using Bifrost.Skills.Contracts;

namespace Bifrost.Capabilities.Editor;

/// <summary>
/// Builds cross-layer proposal effects for an intended layer edit so ask, criteria, and evals
/// stay one agreement. Never emits ReplaceSkill — skill staleness is a read comparison.
/// </summary>
public static class LayerSyncComposer
{
    public sealed record Composition
    {
        public required string Summary { get; init; }
        public required IReadOnlyList<ProposalEffect> Effects { get; init; }

        /// <summary>
        /// True when another layer's wording would move. Mechanical check re-derives alone
        /// do not require a proposal ceremony.
        /// </summary>
        public required bool RequiresProposal { get; init; }
    }

    public static Composition FromAskEdit(CapabilityVersionSnapshot current, string newAsk)
    {
        var ask = newAsk.Trim();
        var effects = new List<ProposalEffect>
        {
            new()
            {
                Kind = ProposalEffectKinds.AmendAsk,
                Description = "Reword the ask",
                Ask = ask,
            },
        };

        var wordingChanged = false;
        foreach (var criterion in current.Criteria)
        {
            var aligned = AlignCriterionToAsk(current.Ask, ask, criterion.Statement);
            if (aligned is null)
            {
                continue;
            }

            wordingChanged = true;
            effects.Add(
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.SharpenCriterion,
                    Description = "Re-read criterion against the ask",
                    CriterionId = criterion.Id,
                    Statement = aligned,
                }
            );

            foreach (var eval in current.Evals.Where(e => e.CriterionId == criterion.Id))
            {
                effects.Add(AmendEvalEffect(eval, aligned, eval.Scenario, eval.Prompt, eval.Context));
            }
        }

        return new Composition
        {
            Summary = wordingChanged
                ? "Amend ask and sync criteria"
                : "Amend ask",
            Effects = effects,
            RequiresProposal = wordingChanged,
        };
    }

    public static Composition FromCriterionEdit(
        CapabilityVersionSnapshot current,
        Guid criterionId,
        string newStatement
    )
    {
        var criterion =
            current.Criteria.FirstOrDefault(c => c.Id == criterionId)
            ?? throw new CommandValidationException($"Criterion {criterionId} not found.");

        var statement = newStatement.Trim();
        var effects = new List<ProposalEffect>
        {
            new()
            {
                Kind = ProposalEffectKinds.SharpenCriterion,
                Description = "Sharpen criterion wording",
                CriterionId = criterionId,
                Statement = statement,
            },
        };

        var askAligned = AlignAskToCriterion(current.Ask, criterion.Statement, statement);
        var askChanged = askAligned is not null;
        if (askAligned is not null)
        {
            effects.Insert(
                0,
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.AmendAsk,
                    Description = "Amend ask to match criterion",
                    Ask = askAligned,
                }
            );
        }

        foreach (var eval in current.Evals.Where(e => e.CriterionId == criterionId))
        {
            effects.Add(AmendEvalEffect(eval, statement, eval.Scenario, eval.Prompt, eval.Context));
        }

        return new Composition
        {
            Summary = askChanged
                ? "Sharpen criterion and amend ask"
                : "Sharpen criterion",
            Effects = effects,
            RequiresProposal = askChanged,
        };
    }

    public static Composition FromEvalEdit(
        CapabilityVersionSnapshot current,
        Guid evalId,
        string scenario,
        string prompt,
        string context,
        IReadOnlyList<CheckSnapshot>? requestedChecks
    )
    {
        var existing =
            current.Evals.FirstOrDefault(e => e.Id == evalId)
            ?? throw new CommandValidationException($"Eval {evalId} not found.");

        var criterion =
            current.Criteria.FirstOrDefault(c => c.Id == existing.CriterionId)
            ?? throw new CommandValidationException(
                $"Criterion {existing.CriterionId} not found."
            );

        var trimmedScenario = scenario.Trim();
        var trimmedPrompt = prompt.Trim();
        var trimmedContext = context.Trim();
        var scenarioChanged = !string.Equals(
            existing.Scenario,
            trimmedScenario,
            StringComparison.Ordinal
        );

        var effects = new List<ProposalEffect>();
        var wordingChanged = false;

        var criterionStatement = criterion.Statement;
        if (scenarioChanged && DetachesFromCriterion(criterion.Statement, trimmedScenario))
        {
            criterionStatement = AlignCriterionToScenario(criterion.Statement, trimmedScenario);
            wordingChanged = true;
            effects.Add(
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.SharpenCriterion,
                    Description = "Keep criterion honest with the eval",
                    CriterionId = criterion.Id,
                    Statement = criterionStatement,
                }
            );

            var askAligned = AlignAskToCriterion(
                current.Ask,
                criterion.Statement,
                criterionStatement
            );
            if (askAligned is not null)
            {
                effects.Insert(
                    0,
                    new ProposalEffect
                    {
                        Kind = ProposalEffectKinds.AmendAsk,
                        Description = "Amend ask to match criterion",
                        Ask = askAligned,
                    }
                );
            }
        }

        var checks = ResolveChecks(
            existing.Checks,
            requestedChecks,
            criterionStatement,
            trimmedScenario,
            scenarioChanged
        );

        effects.Add(
            new ProposalEffect
            {
                Kind = ProposalEffectKinds.AmendEval,
                Description = "Amend eval scenario",
                EvalId = evalId,
                CriterionId = existing.CriterionId,
                Scenario = trimmedScenario,
                Prompt = trimmedPrompt,
                Context = trimmedContext,
                Checks = checks,
            }
        );

        return new Composition
        {
            Summary = wordingChanged
                ? "Amend eval and sync criterion"
                : "Amend eval",
            Effects = effects,
            RequiresProposal = wordingChanged,
        };
    }

    public static Composition FromAddCriterion(
        CapabilityVersionSnapshot current,
        string statement
    )
    {
        var trimmed = statement.Trim();
        var criterionId = Guid.NewGuid();
        var evalId = Guid.NewGuid();
        var checkId = Guid.NewGuid();
        var scenario = $"Given: {trimmed}";
        var ask = current.Ask.Contains(trimmed, StringComparison.OrdinalIgnoreCase)
            ? current.Ask
            : AppendToAsk(current.Ask, trimmed);

        var effects = new List<ProposalEffect>();
        var askChanged = !string.Equals(ask, current.Ask, StringComparison.Ordinal);
        if (askChanged)
        {
            effects.Add(
                new ProposalEffect
                {
                    Kind = ProposalEffectKinds.AmendAsk,
                    Description = "Amend ask to include criterion",
                    Ask = ask,
                }
            );
        }

        effects.Add(
            new ProposalEffect
            {
                Kind = ProposalEffectKinds.AddCriterion,
                Description = "Add criterion",
                CriterionId = criterionId,
                Statement = trimmed,
            }
        );
        effects.Add(
            new ProposalEffect
            {
                Kind = ProposalEffectKinds.AddEval,
                Description = "Add proving eval",
                EvalId = evalId,
                CriterionId = criterionId,
                Scenario = scenario,
                Prompt = scenario,
                Context = "",
                Checks = [CheckDerivation.ScriptCheck(checkId, trimmed, scenario)],
            }
        );

        return new Composition
        {
            Summary = askChanged
                ? "Add criterion, eval, and amend ask"
                : "Add criterion and eval",
            Effects = effects,
            RequiresProposal = true,
        };
    }

    public static string? AlignCriterionToAsk(string oldAsk, string newAsk, string statement)
    {
        if (string.Equals(oldAsk, newAsk, StringComparison.Ordinal))
        {
            return null;
        }

        if (string.Equals(statement, oldAsk, StringComparison.OrdinalIgnoreCase))
        {
            return newAsk;
        }

        if (statement.Contains(oldAsk, StringComparison.OrdinalIgnoreCase))
        {
            return ReplaceIgnoreCase(statement, oldAsk, newAsk);
        }

        if (
            oldAsk.Contains(statement, StringComparison.OrdinalIgnoreCase)
            && !newAsk.Contains(statement, StringComparison.OrdinalIgnoreCase)
        )
        {
            return $"{newAsk.TrimEnd('.')}. Also: {statement}";
        }

        return null;
    }

    public static string? AlignAskToCriterion(
        string ask,
        string oldStatement,
        string newStatement
    )
    {
        if (string.Equals(oldStatement, newStatement, StringComparison.Ordinal))
        {
            return null;
        }

        if (string.Equals(ask, oldStatement, StringComparison.OrdinalIgnoreCase))
        {
            return newStatement;
        }

        if (ask.Contains(oldStatement, StringComparison.OrdinalIgnoreCase))
        {
            return ReplaceIgnoreCase(ask, oldStatement, newStatement);
        }

        // Ask never carried this criterion's wording — leave it alone.
        // (Adding a new criterion amends the ask via FromAddCriterion instead.)
        return null;
    }

    public static bool DetachesFromCriterion(string criterionStatement, string scenario)
    {
        if (string.IsNullOrWhiteSpace(criterionStatement))
        {
            return false;
        }

        return !scenario.Contains(criterionStatement, StringComparison.OrdinalIgnoreCase)
            && !criterionStatement.Contains(scenario, StringComparison.OrdinalIgnoreCase);
    }

    public static string AlignCriterionToScenario(string oldStatement, string scenario)
    {
        var trimmed = scenario.Trim();
        if (trimmed.Length == 0)
        {
            return oldStatement;
        }

        // Prefer a short plain-language criterion when the scenario is a long Given/When/Then.
        var firstLine = trimmed.Split('\n', 2, StringSplitOptions.TrimEntries)[0];
        return firstLine.Length <= 240 ? firstLine : firstLine[..237] + "…";
    }

    static ProposalEffect AmendEvalEffect(
        EvalSnapshot eval,
        string criterionStatement,
        string scenario,
        string prompt,
        string context
    ) =>
        new()
        {
            Kind = ProposalEffectKinds.AmendEval,
            Description = "Re-derive checks for synced criterion",
            EvalId = eval.Id,
            CriterionId = eval.CriterionId,
            Scenario = scenario,
            Prompt = prompt,
            Context = context,
            Checks = CheckDerivation.ReDerive(eval.Checks, criterionStatement, scenario),
        };

    static IReadOnlyList<CheckSnapshot> ResolveChecks(
        IReadOnlyList<CheckSnapshot> existing,
        IReadOnlyList<CheckSnapshot>? requested,
        string criterionStatement,
        string scenario,
        bool scenarioChanged
    )
    {
        if (requested is null)
        {
            return scenarioChanged
                ? CheckDerivation.ReDerive(existing, criterionStatement, scenario)
                : existing.ToArray();
        }

        if (scenarioChanged)
        {
            return
            [
                .. requested.Select(check =>
                {
                    var timeoutMs =
                        check.TimeoutMs
                        ?? existing.FirstOrDefault(c => c.Id == check.Id)?.TimeoutMs;
                    var kind = CheckDerivation.RequireKind(check.Kind);
                    return kind == CheckKinds.HumanReview
                        ? CheckDerivation.HumanReviewCheck(
                            check.Id,
                            criterionStatement,
                            timeoutMs
                        )
                        : CheckDerivation.ScriptCheck(
                            check.Id,
                            criterionStatement,
                            scenario,
                            timeoutMs
                        );
                }),
            ];
        }

        return CheckDerivation.ApplyKindOverrides(
            existing,
            requested,
            criterionStatement,
            scenario
        );
    }

    static string AppendToAsk(string ask, string addition)
    {
        var trimmedAsk = ask.Trim();
        var trimmedAddition = addition.Trim();
        if (trimmedAsk.Length == 0)
        {
            return trimmedAddition;
        }

        return trimmedAsk.EndsWith('.')
            ? $"{trimmedAsk} {trimmedAddition}"
            : $"{trimmedAsk}. {trimmedAddition}";
    }

    static string ReplaceIgnoreCase(string haystack, string oldValue, string newValue)
    {
        var index = haystack.IndexOf(oldValue, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return haystack;
        }

        return string.Concat(
            haystack.AsSpan(0, index),
            newValue,
            haystack.AsSpan(index + oldValue.Length)
        );
    }
}
